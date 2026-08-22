import logging
from uuid import UUID

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TODO, Document, Folder, Project, Snippet, TodoList
from .serializers import (
    DocumentCardSerializer,
    DocumentSerializer,
    FolderSerializer,
    ProjectSerializer,
    SnippetSerializer,
    TodoListSerializer,
    TODOSerializer,
)

logger = logging.getLogger("workspace")

RECENT_PROJECTS_LIMIT = 4
RECENT_PROJECTS_MAX = 20


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Returns only the projects of the logged-in user. The plain listing shows
        one shelf at a time: the active projects, or the archived ones under
        ?archived=true. Every other route reaches a project whatever its shelf.
        """
        queryset = (
            Project.objects.filter(user=self.request.user)
            .annotate(
                open_todos_count=Count(
                    "todos",
                    filter=Q(todos__status__in=TODO.OPEN_STATUSES),
                    distinct=True,
                )
            )
            .order_by("-created_at")
        )

        if self.action == "list":
            queryset = queryset.filter(is_archived=read_archived(self.request))

        return queryset

    def perform_create(self, serializer):
        """Automatically associate the project with the logged-in user"""
        project = serializer.save(user=self.request.user)
        logger.info(
            f"Project '{project.title}' (ID: {project.id}) "
            f"created by user {self.request.user.username}"
        )

    @action(detail=True, methods=["post"])
    def open(self, request, *args, **kwargs):
        """
        Stamp the project as opened now, so the welcome screen can list the
        projects the user came back to most recently.
        """
        project = self.get_object()
        project.last_opened_at = timezone.now()
        project.save(update_fields=["last_opened_at"])

        return Response(self.get_serializer(project).data)

    @action(detail=True, methods=["post"])
    def archive(self, request, *args, **kwargs):
        """Move the project to the archived shelf."""
        project = self.get_object()
        project.is_archived = True
        project.archived_at = timezone.now()
        project.save(update_fields=["is_archived", "archived_at"])

        return Response(self.get_serializer(project).data)

    @action(detail=True, methods=["post"])
    def unarchive(self, request, *args, **kwargs):
        """Bring the project back among the active ones."""
        project = self.get_object()
        project.is_archived = False
        project.archived_at = None
        project.save(update_fields=["is_archived", "archived_at"])

        return Response(self.get_serializer(project).data)

    @action(detail=False, methods=["get"])
    def recent(self, request, *args, **kwargs):
        """
        Projects the user opened most recently, at most ?limit= of them.
        A project never opened falls back on its last modification date and
        sorts after every project carrying a real opening date.
        """
        limit = read_limit(request, RECENT_PROJECTS_LIMIT, RECENT_PROJECTS_MAX)
        projects = self.get_queryset().order_by(
            F("last_opened_at").desc(nulls_last=True), "-updated_at"
        )[:limit]

        return Response(self.get_serializer(projects, many=True).data)

    @action(detail=True, methods=["get"])
    def contents(self, request, *args, **kwargs):
        """
        Folders then items sitting at the root of a project, for the resource
        asked by ?resource_type= (documents by default).
        """
        project = self.get_object()
        resource_type = read_resource_type(request)
        folders = project.folders.filter(
            parent__isnull=True, resource_type=resource_type
        )

        if resource_type == "snippets":
            return paginated_contents(
                self,
                folders,
                project.snippets.filter(folder__isnull=True),
                "snippet",
                SnippetSerializer,
            )

        return paginated_contents(
            self,
            folders,
            project.documents.filter(folder__isnull=True),
        )

    @action(detail=True, methods=["get"])
    def pinned(self, request, *args, **kwargs):
        """
        Pinned documents of a project, wherever they sit in the folder tree, in
        the gallery card shape so they render like any other document.
        """
        project = self.get_object()

        return paginated_contents(
            self,
            Folder.objects.none(),
            project.documents.filter(is_pinned=True),
        )


class ChainedQuerysets:
    """
    Presents several querysets as one sliceable sequence, so the standard
    paginator can page across them while only fetching the rows of the
    requested page.
    """

    def __init__(self, *querysets):
        self.querysets = querysets
        self._counts = None

    @property
    def counts(self):
        if self._counts is None:
            self._counts = [queryset.count() for queryset in self.querysets]
        return self._counts

    def count(self):
        return sum(self.counts)

    def __len__(self):
        return self.count()

    def __getitem__(self, window):
        start = window.start or 0
        stop = window.stop
        offset = 0
        items = []

        for queryset, count in zip(self.querysets, self.counts):
            if stop is not None and offset >= stop:
                break

            local_start = max(0, start - offset)

            if local_start < count:
                local_stop = None if stop is None else stop - offset
                items.extend(queryset[local_start:local_stop])

            offset += count

        return items


RESOURCE_TYPES = [choice[0] for choice in Folder.RESOURCE_TYPE_CHOICES]


def read_resource_type(request):
    """The ?resource_type= a listing is asked for, documents by default."""
    value = request.query_params.get("resource_type")

    if value is None:
        return "documents"

    if value not in RESOURCE_TYPES:
        raise ValidationError(
            {"resource_type": f"Must be one of: {', '.join(RESOURCE_TYPES)}."}
        )

    return value


def read_archived(request):
    """The shelf a project listing is asked for, the active one by default."""
    value = request.query_params.get("archived")

    if value is None:
        return False

    if value not in ("true", "false"):
        raise ValidationError({"archived": "Must be true or false."})

    return value == "true"


def read_limit(request, default, maximum):
    """The ?limit= a listing is asked for, clamped to what the view allows."""
    value = request.query_params.get("limit")

    if value is None:
        return default

    try:
        limit = int(value)
    except ValueError:
        raise ValidationError({"limit": "Must be a positive integer."})

    if limit < 1:
        raise ValidationError({"limit": "Must be a positive integer."})

    return min(limit, maximum)


def read_uuid(value, field):
    """The value of an id sent in a move payload, or a 400."""
    try:
        return UUID(str(value))
    except ValueError:
        raise ValidationError({field: f"Invalid {field} id."})


def resolve_move_project(request, current_project):
    """
    Destination project of a move. An absent project keeps the resource where
    it is, so the same endpoint serves both kinds of move.
    """
    value = request.data.get("project")

    if value in (None, ""):
        return current_project

    try:
        return Project.objects.get(id=read_uuid(value, "project"), user=request.user)
    except Project.DoesNotExist:
        raise PermissionDenied("Project not found or access denied.")


def resolve_move_folder(request, field, project, resource_type):
    """Destination folder of a move, None for the root of the project."""
    value = request.data.get(field)

    if value in (None, ""):
        return None

    folder = Folder.objects.filter(
        id=read_uuid(value, field), project__user=request.user
    ).first()

    if folder is None:
        raise ValidationError({field: "Folder not found."})

    if folder.project_id != project.id:
        raise ValidationError({field: "Folder must belong to the destination project."})

    if folder.resource_type != resource_type:
        raise ValidationError({field: f"Folder does not hold {resource_type}."})

    return folder


def resolve_move_list(request, project):
    """
    Destination list of a todo move, None for the unclassified ones. A todo
    landing in another project cannot keep a list of the one it leaves.
    """
    value = request.data.get("list")

    if value in (None, ""):
        return None

    todo_list = TodoList.objects.filter(
        id=read_uuid(value, "list"), project__user=request.user
    ).first()

    if todo_list is None:
        raise ValidationError({"list": "List not found."})

    if todo_list.project_id != project.id:
        raise ValidationError({"list": "List must belong to the destination project."})

    return todo_list


def guard_folder_name(folder, project, parent):
    """A folder cannot join a place where its name is already taken."""
    siblings = Folder.objects.filter(
        project=project, parent=parent, name=folder.name
    ).exclude(id=folder.id)

    if parent is None:
        siblings = siblings.filter(resource_type=folder.resource_type)

    if siblings.exists():
        raise ValidationError(
            {"name": f"A folder named '{folder.name}' already exists here."}
        )


def folders_with_counts(queryset):
    """Annotate direct children and item counts, for the gallery cards."""
    return queryset.annotate(
        folder_count=Count("children", distinct=True),
        document_count=Count("documents", distinct=True),
        snippet_count=Count("snippets", distinct=True),
    ).order_by("name")


def paginated_contents(
    view, folders, items, item_type="document", item_serializer=DocumentCardSerializer
):
    """
    Serialize direct subfolders then direct items as one paginated stream;
    every entry carries a 'type' telling the two apart.
    """
    context = view.get_serializer_context()
    entries = ChainedQuerysets(
        folders_with_counts(folders).select_related("project", "parent"),
        items.select_related("project", "folder"),
    )

    def represent(entry):
        if isinstance(entry, Folder):
            return {"type": "folder", **FolderSerializer(entry, context=context).data}

        return {
            "type": item_type,
            **item_serializer(entry, context=context).data,
        }

    page = view.paginate_queryset(entries)

    if page is not None:
        return view.get_paginated_response([represent(entry) for entry in page])

    return Response([represent(entry) for entry in entries[0:None]])


class ProjectScopedViewSet(viewsets.ModelViewSet):
    """Shared plumbing for resources nested under a project."""

    permission_classes = [IsAuthenticated]

    def get_project(self):
        project_pk = self.kwargs.get("project_pk")

        if not project_pk:
            return None

        try:
            return Project.objects.get(id=project_pk, user=self.request.user)
        except (Project.DoesNotExist, ValueError, DjangoValidationError):
            raise PermissionDenied("Project not found or access denied.")

    def get_serializer_context(self):
        context = super().get_serializer_context()

        if getattr(self, "swagger_fake_view", False):
            return context

        if self.kwargs.get("project_pk"):
            context["project"] = self.get_project()
        elif self.detail and self.kwargs.get("pk"):
            instance = self.get_queryset().filter(pk=self.kwargs["pk"]).first()
            if instance is not None:
                context["project"] = instance.project

        return context

    def filter_by_relation(self, queryset, param, field):
        """Apply ?<param>=<uuid|null> as a filter on <field>."""
        value = self.request.query_params.get(param)

        if value is None:
            return queryset

        if value == "null":
            return queryset.filter(**{f"{field}__isnull": True})

        try:
            UUID(value)
        except ValueError:
            raise ValidationError({param: f"Invalid {param} id."})

        return queryset.filter(**{f"{field}__id": value})


class FolderViewSet(ProjectScopedViewSet):
    """
    ViewSet for Folder CRUD operations
    - Nested under /api/projects/{id}/folders/
    - ?parent=<uuid> or ?parent=null narrows the listing to one level
    - ?resource_type=documents|snippets narrows it to one kind of folder
    """

    serializer_class = FolderSerializer

    def get_queryset(self):
        """Returns only the folders of the logged-in user"""
        project_pk = self.kwargs.get("project_pk")
        queryset = Folder.objects.filter(project__user=self.request.user)

        if project_pk:
            queryset = queryset.filter(project__id=project_pk)

        if self.request.query_params.get("resource_type") is not None:
            queryset = queryset.filter(resource_type=read_resource_type(self.request))

        queryset = self.filter_by_relation(queryset, "parent", "parent")

        return folders_with_counts(queryset).select_related("project", "parent")

    def perform_create(self, serializer):
        """Assign project from URL and verify ownership"""
        project = self.get_project()

        if project is None:
            raise PermissionDenied("Project not found or access denied.")

        folder = serializer.save(project=project)
        logger.info(
            f"Folder '{folder.name}' (ID: {folder.id}) created in project {project.id} "
            f"by user {self.request.user.username}"
        )

    def destroy(self, request, *args, **kwargs):
        """
        Deleting a folder cascades to its subfolders and their documents, so a
        non-empty folder requires ?confirm=true and reports what would go.
        """
        folder = self.get_object()
        counts = folder.cascade_counts()
        confirmed = request.query_params.get("confirm") == "true"
        held = "document" if folder.resource_type == "documents" else "snippet"
        held_count = counts[f"{held}s"]

        if not confirmed and (counts["folders"] or held_count):
            return Response(
                {
                    "detail": (
                        "This folder is not empty. Deleting it will also delete "
                        f"{counts['folders']} subfolder(s) and "
                        f"{held_count} {held}(s). "
                        "Repeat the request with ?confirm=true to proceed."
                    ),
                    "code": "folder_not_empty",
                    "folders": counts["folders"],
                    "documents": counts["documents"],
                    "snippets": counts["snippets"],
                },
                status=status.HTTP_409_CONFLICT,
            )

        logger.info(
            f"Folder '{folder.name}' (ID: {folder.id}) deleted with "
            f"{counts['folders']} subfolder(s) and {held_count} {held}(s) "
            f"by user {request.user.username}"
        )

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def contents(self, request, *args, **kwargs):
        """
        Direct subfolders then direct items of a folder. The folder knows the
        kind of resource it holds, so this takes no parameter.
        """
        folder = self.get_object()

        if folder.resource_type == "snippets":
            return paginated_contents(
                self,
                folder.children.all(),
                folder.snippets.all(),
                "snippet",
                SnippetSerializer,
            )

        return paginated_contents(self, folder.children.all(), folder.documents.all())

    @action(detail=True, methods=["post"])
    def move(self, request, *args, **kwargs):
        """
        Move a folder, with everything nested under it, to another parent or
        another project.
        """
        folder = self.get_object()
        project = resolve_move_project(request, folder.project)
        parent = resolve_move_folder(request, "parent", project, folder.resource_type)

        if parent is not None:
            if parent.id == folder.id:
                raise ValidationError({"parent": "A folder cannot be its own parent."})

            if folder.id in parent.ancestor_ids():
                raise ValidationError(
                    {"parent": "A folder cannot be its own ancestor."}
                )

        guard_folder_name(folder, project, parent)

        counts = folder.cascade_counts()
        folder.move_to(project, parent)

        logger.info(
            f"Folder '{folder.name}' (ID: {folder.id}) moved to project "
            f"{project.id} with {counts['folders']} subfolder(s), "
            f"{counts['documents']} document(s) and {counts['snippets']} snippet(s) "
            f"by user {request.user.username}"
        )

        return Response(self.get_serializer(folder).data)


def copy_title(title, taken, max_length):
    """
    Title for a copy of <title>, numbered from the second copy on so that
    duplicating twice in the same place does not yield two identical names.
    """
    index = 1

    while True:
        suffix = " (copy)" if index == 1 else f" (copy {index})"
        candidate = f"{title[:max_length - len(suffix)]}{suffix}"

        if candidate not in taken:
            return candidate

        index += 1


class DocumentViewSet(ProjectScopedViewSet):
    serializer_class = DocumentSerializer

    def get_queryset(self):
        """Returns only the documents of the logged-in user"""
        project_pk = self.kwargs.get("project_pk")
        queryset = Document.objects.filter(project__user=self.request.user)

        if project_pk:
            queryset = queryset.filter(project__id=project_pk)

        queryset = self.filter_by_relation(queryset, "folder", "folder")

        return queryset.select_related("project", "folder")

    def perform_create(self, serializer):
        """Assign project from URL and verify ownership"""
        project = self.get_project()

        if project is None:
            raise PermissionDenied("Project not found or access denied.")

        serializer.save(project=project)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, *args, **kwargs):
        """Copy a document, content included, into the folder holding it"""
        document = self.get_object()
        taken = set(
            Document.objects.filter(
                project=document.project, folder=document.folder
            ).values_list("title", flat=True)
        )

        copy = Document.objects.create(
            title=copy_title(
                document.title,
                taken,
                Document._meta.get_field("title").max_length,
            ),
            content=document.content,
            project=document.project,
            folder=document.folder,
        )

        logger.info(
            f"Document '{document.title}' (ID: {document.id}) duplicated as "
            f"'{copy.title}' (ID: {copy.id}) by user {request.user.username}"
        )

        serializer = self.get_serializer(copy)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def move(self, request, *args, **kwargs):
        """Move a document to another folder, another project, or both"""
        document = self.get_object()
        project = resolve_move_project(request, document.project)
        folder = resolve_move_folder(request, "folder", project, "documents")

        with transaction.atomic():
            document.project = project
            document.folder = folder
            document.save()

        return Response(self.get_serializer(document).data)


class SnippetViewSet(ProjectScopedViewSet):
    """
    ViewSet for Snippet CRUD operations
    - Nested under /api/projects/{id}/snippets/
    - User isolation via project ownership
    - ?folder=<uuid> or ?folder=null narrows the listing to one level
    """

    serializer_class = SnippetSerializer

    def get_queryset(self):
        """Returns only the snippet of the logged_in user"""
        project_pk = self.kwargs.get("project_pk")
        queryset = Snippet.objects.filter(project__user=self.request.user)

        if project_pk:
            queryset = queryset.filter(project__id=project_pk)

        queryset = self.filter_by_relation(queryset, "folder", "folder")

        return queryset.select_related("project", "folder")

    def perform_create(self, serializer):
        """Inject project from URL and verify ownership"""
        project = self.get_project()

        if project is None:
            raise PermissionDenied("Project not found or access denied.")

        snippet = serializer.save(project=project)
        logger.info(
            f"Snippet '{snippet.title}' (ID: {snippet.id}) created in "
            f"project {project.id} by user {self.request.user.username}"
        )

    @action(detail=False, methods=["get"])
    def pinned(self, request, *args, **kwargs):
        """
        Pinned snippets of a project, in the same shape as the plain listing so
        they render like any other snippet.
        """
        queryset = self.filter_queryset(self.get_queryset().filter(is_pinned=True))
        page = self.paginate_queryset(queryset)

        if page is not None:
            return self.get_paginated_response(
                self.get_serializer(page, many=True).data
            )

        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, *args, **kwargs):
        """Copy a snippet, code included, into the folder holding it"""
        snippet = self.get_object()
        taken = set(
            Snippet.objects.filter(
                project=snippet.project, folder=snippet.folder
            ).values_list("title", flat=True)
        )

        copy = Snippet.objects.create(
            title=copy_title(
                snippet.title,
                taken,
                Snippet._meta.get_field("title").max_length,
            ),
            content=snippet.content,
            language=snippet.language,
            description=snippet.description,
            project=snippet.project,
            folder=snippet.folder,
        )

        logger.info(
            f"Snippet '{snippet.title}' (ID: {snippet.id}) duplicated as "
            f"'{copy.title}' (ID: {copy.id}) by user {request.user.username}"
        )

        serializer = self.get_serializer(copy)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def move(self, request, *args, **kwargs):
        """Move a snippet to another folder, another project, or both"""
        snippet = self.get_object()
        project = resolve_move_project(request, snippet.project)
        folder = resolve_move_folder(request, "folder", project, "snippets")

        with transaction.atomic():
            snippet.project = project
            snippet.folder = folder
            snippet.save()

        return Response(self.get_serializer(snippet).data)


class TodoListViewSet(ProjectScopedViewSet):
    """
    ViewSet for TodoList CRUD operations
    - Nested under /api/projects/{id}/todo-lists/
    - Lists are flat: deleting one leaves its todos unclassified
    """

    serializer_class = TodoListSerializer

    def get_queryset(self):
        """Returns only the todo lists of the logged-in user"""
        project_pk = self.kwargs.get("project_pk")
        queryset = TodoList.objects.filter(project__user=self.request.user)

        if project_pk:
            queryset = queryset.filter(project__id=project_pk)

        return (
            queryset.annotate(todo_count=Count("todos", distinct=True))
            .select_related("project")
            .order_by("name")
        )

    def perform_create(self, serializer):
        """Assign project from URL and verify ownership"""
        project = self.get_project()

        if project is None:
            raise PermissionDenied("Project not found or access denied.")

        todo_list = serializer.save(project=project)
        logger.info(
            f"TODO list '{todo_list.name}' (ID: {todo_list.id}) created in project "
            f"{project.id} by user {self.request.user.username}"
        )

    def destroy(self, request, *args, **kwargs):
        """Deleting a list unclassifies its todos rather than removing them"""
        todo_list = self.get_object()
        released = todo_list.todos.count()

        logger.info(
            f"TODO list '{todo_list.name}' (ID: {todo_list.id}) deleted, "
            f"{released} TODO(s) left unclassified by user {request.user.username}"
        )

        return super().destroy(request, *args, **kwargs)


class TODOViewSet(ProjectScopedViewSet):
    """
    ViewSet for Todo CRUD operations
    - Nested under /api/projects/{id}/todos/
    - User isolation via project ownership
    - ?list=<uuid> narrows to one list, ?list=null to the unclassified ones;
      no filter at all returns every todo of the project
    - /pinned/ lists the pinned ones, for the sidebar rail
    """

    serializer_class = TODOSerializer

    def get_queryset(self):
        """Return only the Todo of the logged user"""
        project_pk = self.kwargs.get("project_pk")
        queryset = TODO.objects.filter(project__user=self.request.user)

        # Filter by project (nested routes)
        if project_pk:
            queryset = queryset.filter(project__id=project_pk)
        elif self.action == "list":
            queryset = queryset.exclude(project__is_archived=True)

        # Filter by status (query_param)
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        # Filter by priority (query_param)
        priority_param = self.request.query_params.get("priority")
        if priority_param:
            queryset = queryset.filter(priority=priority_param)

        queryset = self.filter_by_relation(queryset, "list", "list")

        return queryset.select_related("project", "list")

    def perform_create(self, serializer):
        """Inject project from URL for nested routes"""
        project = self.get_project()

        if project is None:
            raise PermissionDenied("Project not found or access denied.")

        todo = serializer.save(project=project)
        logger.info(
            f"TODO '{todo.title}' (ID: {todo.id}) created in "
            f"project {project.id} by user {self.request.user.username}"
        )

    @action(detail=False, methods=["get"])
    def pinned(self, request, *args, **kwargs):
        """
        Pinned TODOs of a project, in the same shape as the plain listing so a
        caller reads their status without a second round trip.
        """
        queryset = self.filter_queryset(self.get_queryset().filter(is_pinned=True))
        page = self.paginate_queryset(queryset)

        if page is not None:
            return self.get_paginated_response(
                self.get_serializer(page, many=True).data
            )

        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=["post"])
    def move(self, request, *args, **kwargs):
        """
        Move a TODO to another list, another project, or both. A TODO landing
        in another project without a list of its own becomes unclassified.
        """
        todo = self.get_object()
        project = resolve_move_project(request, todo.project)
        todo_list = resolve_move_list(request, project)

        with transaction.atomic():
            todo.project = project
            todo.list = todo_list
            todo.save()

        return Response(self.get_serializer(todo).data)


@method_decorator(ratelimit(key="user", rate="30/m", method="GET"), name="get")
class SearchView(APIView):
    """
    Global search across Documents, Snippets and TODOs
    GET /api/search/?q=<query>&type=<documents|snippets|todos>
    """

    permission_classes = [permissions.IsAuthenticated]

    MAX_QUERY_LENGTH = 200

    def get(self, request):
        if getattr(request, "limited", False):
            return Response(
                {"error": "Too many search requests. Please slow down."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        query = request.query_params.get("q")
        search_type = request.query_params.get("type")

        if not query:
            return Response(
                {"error": 'Search query parameter "q" is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(query) > self.MAX_QUERY_LENGTH:
            return Response(
                {"error": f"Query too long (max {self.MAX_QUERY_LENGTH} characters)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        VALID_TYPES = ["projects", "documents", "snippets", "todos"]
        if search_type and search_type not in VALID_TYPES:
            return Response(
                {
                    "error": f'Invalid type. Must be one of: {", ".join(VALID_TYPES)}',
                    "code": "INVALID_TYPE",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        project_param = request.query_params.get("project")
        project = None

        if project_param:
            try:
                project = Project.objects.get(id=UUID(project_param), user=user)
            except (ValueError, Project.DoesNotExist):
                return Response(
                    {
                        "error": "Project not found or access denied.",
                        "code": "INVALID_PROJECT",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

        results = {}

        # Search in Projects
        if not search_type or search_type == "projects":
            projects = Project.objects.filter(user=user).filter(
                Q(title__icontains=query) | Q(description__icontains=query)
            )

            if project is not None:
                projects = projects.filter(id=project.id)

            from .serializers import ProjectSerializer as PS

            results["projects"] = PS(projects, many=True).data

        # Search in Documents
        if not search_type or search_type == "documents":
            documents = (
                Document.objects.filter(project__user=user)
                .filter(Q(title__icontains=query) | Q(content__icontains=query))
                .select_related("project")
            )

            if project is not None:
                documents = documents.filter(project=project)
            results["documents"] = DocumentSerializer(documents, many=True).data

        # Search in Snippets
        if not search_type or search_type == "snippets":
            snippets = (
                Snippet.objects.filter(project__user=user)
                .filter(
                    Q(title__icontains=query)
                    | Q(content__icontains=query)
                    | Q(language__icontains=query)
                    | Q(description__icontains=query)
                )
                .select_related("project")
            )

            if project is not None:
                snippets = snippets.filter(project=project)

            results["snippets"] = SnippetSerializer(snippets, many=True).data

        # Search in TODOs
        if not search_type or search_type == "todos":
            todos = (
                TODO.objects.filter(project__user=user)
                .filter(
                    Q(title__icontains=query)
                    | Q(description__icontains=query)
                    | Q(status__icontains=query)
                    | Q(priority__icontains=query)
                )
                .select_related("project")
            )

            if project is not None:
                todos = todos.filter(project=project)

            results["todos"] = TODOSerializer(todos, many=True).data

        return Response(results, status=status.HTTP_200_OK)
