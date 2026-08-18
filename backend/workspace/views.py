from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from django.db.models import Count, Q
from django.core.exceptions import ValidationError as DjangoValidationError
from uuid import UUID
from .models import Project, Folder, Note, Snippet, TODO
from .serializers import (
    ProjectSerializer,
    FolderSerializer,
    NoteSerializer,
    NoteCardSerializer,
    SnippetSerializer,
    TODOSerializer,
)
import logging

logger = logging.getLogger('workspace')


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Returns only the projects of the logged-in user"""
        return Project.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Automatically associate the project with the logged-in user"""
        project = serializer.save(user=self.request.user)
        logger.info(f"Project '{project.title}' (ID: {project.id}) created by user {self.request.user.username}")

    @action(detail=True, methods=['get'])
    def contents(self, request, *args, **kwargs):
        """Folders then notes sitting at the root of a project"""
        project = self.get_object()

        return paginated_contents(
            self,
            project.folders.filter(parent__isnull=True),
            project.notes.filter(folder__isnull=True),
        )

    @action(detail=True, methods=['get'])
    def pinned(self, request, *args, **kwargs):
        """
        Pinned notes of a project, wherever they sit in the folder tree, in
        the gallery card shape so they render like any other note.
        """
        project = self.get_object()

        return paginated_contents(
            self,
            Folder.objects.none(),
            project.notes.filter(is_pinned=True),
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


def folders_with_counts(queryset):
    """Annotate direct children and note counts, for the gallery cards."""
    return queryset.annotate(
        folder_count=Count('children', distinct=True),
        note_count=Count('notes', distinct=True),
    ).order_by('name')


def paginated_contents(view, folders, notes):
    """
    Serialize direct subfolders then direct notes as one paginated stream;
    every entry carries a 'type' telling the two apart.
    """
    context = view.get_serializer_context()
    entries = ChainedQuerysets(
        folders_with_counts(folders).select_related('project', 'parent'),
        notes.select_related('project', 'folder'),
    )

    def represent(entry):
        if isinstance(entry, Folder):
            return {'type': 'folder', **FolderSerializer(entry, context=context).data}

        return {'type': 'note', **NoteCardSerializer(entry, context=context).data}

    page = view.paginate_queryset(entries)

    if page is not None:
        return view.get_paginated_response([represent(entry) for entry in page])

    return Response([represent(entry) for entry in entries[0:None]])


class ProjectScopedViewSet(viewsets.ModelViewSet):
    """Shared plumbing for resources nested under a project."""
    permission_classes = [IsAuthenticated]

    def get_project(self):
        project_pk = self.kwargs.get('project_pk')

        if not project_pk:
            return None

        try:
            return Project.objects.get(id=project_pk, user=self.request.user)
        except (Project.DoesNotExist, ValueError, DjangoValidationError):
            raise PermissionDenied("Project not found or access denied.")

    def get_serializer_context(self):
        context = super().get_serializer_context()

        if getattr(self, 'swagger_fake_view', False):
            return context

        if self.kwargs.get('project_pk'):
            context['project'] = self.get_project()
        elif self.detail and self.kwargs.get('pk'):
            instance = self.get_queryset().filter(pk=self.kwargs['pk']).first()
            if instance is not None:
                context['project'] = instance.project

        return context

    def filter_by_relation(self, queryset, param, field):
        """Apply ?<param>=<uuid|null> as a filter on <field>."""
        value = self.request.query_params.get(param)

        if value is None:
            return queryset

        if value == 'null':
            return queryset.filter(**{f'{field}__isnull': True})

        try:
            UUID(value)
        except ValueError:
            raise ValidationError({param: f"Invalid {param} id."})

        return queryset.filter(**{f'{field}__id': value})


class FolderViewSet(ProjectScopedViewSet):
    """
    ViewSet for Folder CRUD operations
    - Nested under /api/projects/{id}/folders/
    - ?parent=<uuid> or ?parent=null narrows the listing to one level
    """
    serializer_class = FolderSerializer

    def get_queryset(self):
        """Returns only the folders of the logged-in user"""
        project_pk = self.kwargs.get('project_pk')
        queryset = Folder.objects.filter(project__user=self.request.user)

        if project_pk:
            queryset = queryset.filter(project__id=project_pk)

        queryset = self.filter_by_relation(queryset, 'parent', 'parent')

        return folders_with_counts(queryset).select_related('project', 'parent')

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
        Deleting a folder cascades to its subfolders and their notes, so a
        non-empty folder requires ?confirm=true and reports what would go.
        """
        folder = self.get_object()
        counts = folder.cascade_counts()
        confirmed = request.query_params.get('confirm') == 'true'

        if not confirmed and (counts['folders'] or counts['notes']):
            return Response(
                {
                    'detail': (
                        "This folder is not empty. Deleting it will also delete "
                        f"{counts['folders']} subfolder(s) and {counts['notes']} note(s). "
                        "Repeat the request with ?confirm=true to proceed."
                    ),
                    'code': 'folder_not_empty',
                    'folders': counts['folders'],
                    'notes': counts['notes'],
                },
                status=status.HTTP_409_CONFLICT
            )

        logger.info(
            f"Folder '{folder.name}' (ID: {folder.id}) deleted with "
            f"{counts['folders']} subfolder(s) and {counts['notes']} note(s) "
            f"by user {request.user.username}"
        )

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def contents(self, request, *args, **kwargs):
        """Direct subfolders then direct notes of a folder"""
        folder = self.get_object()

        return paginated_contents(self, folder.children.all(), folder.notes.all())


def copy_title(title, taken):
    """
    Title for a copy of <title>, numbered from the second copy on so that
    duplicating twice in the same folder does not yield two identical names.
    """
    max_length = Note._meta.get_field('title').max_length
    index = 1

    while True:
        suffix = ' (copy)' if index == 1 else f' (copy {index})'
        candidate = f'{title[:max_length - len(suffix)]}{suffix}'

        if candidate not in taken:
            return candidate

        index += 1


class NoteViewSet(ProjectScopedViewSet):
    serializer_class = NoteSerializer

    def get_queryset(self):
        """Returns only the notes of the logged-in user"""
        project_pk = self.kwargs.get('project_pk')
        queryset = Note.objects.filter(project__user=self.request.user)

        if project_pk:
            queryset = queryset.filter(project__id=project_pk)

        queryset = self.filter_by_relation(queryset, 'folder', 'folder')

        return queryset.select_related('project', 'folder')

    def perform_create(self, serializer):
        """Assign project from URL and verify ownership"""
        project = self.get_project()

        if project is None:
            raise PermissionDenied("Project not found or access denied.")

        serializer.save(project=project)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, *args, **kwargs):
        """Copy a note, content included, into the folder holding it"""
        note = self.get_object()
        taken = set(
            Note.objects
            .filter(project=note.project, folder=note.folder)
            .values_list('title', flat=True)
        )

        copy = Note.objects.create(
            title=copy_title(note.title, taken),
            content=note.content,
            project=note.project,
            folder=note.folder,
        )

        logger.info(
            f"Note '{note.title}' (ID: {note.id}) duplicated as "
            f"'{copy.title}' (ID: {copy.id}) by user {request.user.username}"
        )

        serializer = self.get_serializer(copy)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SnippetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Snippet CRUD operations
    - Nested under /api/projects/{id}/snippets/
    - User isolation via project ownership
    """
    serializer_class = SnippetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Returns only the snippet of the logged_in user"""
        project_pk = self.kwargs.get('project_pk')
        queryset = Snippet.objects.filter(project__user=self.request.user)

        if project_pk:
            queryset = queryset.filter(project__id=project_pk)
        return queryset.select_related('project')
    
    def perform_create(self, serializer):
        """Inject project from URL and verify ownership"""
        project_pk = self.kwargs.get('project_pk')

        try:
            project = Project.objects.get(
                id=project_pk,
                user=self.request.user
            )
        except Project.DoesNotExist:
            logger.warning(f'User {self.request.user.username} tried to access non-existent project {project_pk}')
            raise PermissionDenied("Project not found or access denied.")

        snippet = serializer.save(project=project)
        logger.info(f"Snippet '{snippet.title}' (ID: {snippet.id}) created in project {project.id} by user {self.request.user.username}")

class TODOViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Todo CRUD operations
    - Nested under /api/projects/{id}/todos/
    - User isolation via project ownership
    """
    serializer_class = TODOSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return only the Todo of the logged user"""
        project_pk = self.kwargs.get('project_pk')
        queryset = TODO.objects.filter(project__user=self.request.user)

        # Filter by project (nested routes)
        if project_pk:
            queryset = queryset.filter(project__id=project_pk)

        # Filter by status (query_param)
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
    
        # Filter by priority (query_param)
        priority_param = self.request.query_params.get('priority')
        if priority_param:
            queryset = queryset.filter(priority=priority_param)
        
        return queryset.select_related('project')
    
    def perform_create(self, serializer):
        """Inject project from URL for nested routes"""
        project_pk = self.kwargs.get('project_pk')

        try:
            project = Project.objects.get(
                id=project_pk,
                user=self.request.user
            )
        except Project.DoesNotExist:
            logger.warning(f'User {self.request.user.username} tried to access non-existent project {project_pk}')
            raise PermissionDenied("Project not found or access denied.")

        todo = serializer.save(project=project)
        logger.info(f"TODO '{todo.title}' (ID: {todo.id}) created in project {project.id} by user {self.request.user.username}")


@method_decorator(ratelimit(key='user', rate='30/m', method='GET'), name='get')
class SearchView(APIView):
    """
    Global search across Notes, Snippets and TODOs
    GET /api/search/?q=<query>&type=<notes|snippets|todos>
    """
    permission_classes = [permissions.IsAuthenticated]

    MAX_QUERY_LENGTH = 200

    def get(self, request):
        if getattr(request, 'limited', False):
            return Response(
                {'error': 'Too many search requests. Please slow down.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        query = request.query_params.get('q')
        search_type = request.query_params.get('type')

        if not query:
            return Response(
                {'error': 'Search query parameter "q" is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(query) > self.MAX_QUERY_LENGTH:
            return Response(
                {'error': f'Query too long (max {self.MAX_QUERY_LENGTH} characters)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        VALID_TYPES = ['projects', 'notes', 'snippets', 'todos']
        if search_type and search_type not in VALID_TYPES:
            return Response(
                {
                    'error': f'Invalid type. Must be one of: {", ".join(VALID_TYPES)}',
                    'code': 'INVALID_TYPE'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        results = {}

        # Search in Projects
        if not search_type or search_type == 'projects':
            projects = Project.objects.filter(user=user).filter(
                Q(title__icontains=query) | Q(description__icontains=query)
            )
            from .serializers import ProjectSerializer as PS
            results['projects'] = PS(projects, many=True).data

        # Search in Notes
        if not search_type or search_type =='notes':
            notes = Note.objects.filter(project__user=user).filter(
                Q(title__icontains=query) | Q(content__icontains=query)
            ).select_related('project')
            results['notes'] = NoteSerializer(notes, many=True).data

        # Search in Snippets
        if not search_type or search_type == 'snippets':
            snippets = Snippet.objects.filter(project__user=user).filter(
                Q(title__icontains=query) |
                Q(content__icontains=query) |
                Q(language__icontains=query) |
                Q(description__icontains=query)
            ).select_related('project')
            results['snippets'] = SnippetSerializer(snippets, many=True).data

        # Search in TODOs
        if not search_type or search_type == 'todos':
            todos = TODO.objects.filter(project__user=user).filter(
                Q(title__icontains=query) |
                Q(description__icontains=query) |
                Q(status__icontains=query) |
                Q(priority__icontains=query)
            ).select_related('project')
            results['todos'] = TODOSerializer(todos, many=True).data

        return Response(results, status=status.HTTP_200_OK)
