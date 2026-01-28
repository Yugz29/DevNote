from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.db.models import Q
from .models import Project, Note, Snippet, TODO
from .serializers import ProjectSerializer, NoteSerializer, SnippetSerializer, TODOSerializer


class IsOwner(permissions.BasePermission):
    """
    Custom permission: verifies that the logged-in user
    is the owner of the object.

    Supported models:
    - Project: checks obj.user
    - Note, Snippet, Todo: checks obj.project.user
    """

    def has_object_permission(self, request, view, obj):
        """Check if the logged-in user is the owner of the object."""
        if not request.user or not request.user.is_authenticated:
            return False

        # Case 1: Direct ownerchip (Project)
        if hasattr(obj, 'user'):
            return obj.user == request.user
        
        # Case 2: Ownership via project (Note, Snippet, Todo)
        if hasattr(obj, 'project'):
            return obj.project.user == request.user
        
        # Case 3: Unknown object type
        return False


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        """Returns only the projects of the logged-in user"""
        return Project.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Automatically associate the project with the logged-in user"""
        serializer.save(user=self.request.user)

class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        """Returns only the notes of the logged-in user"""
        project_pk = self.kwargs.get('project_pk')
        queryset = Note.objects.filter(project__user=self.request.user)

        if project_pk:
            queryset = queryset.filter(project__id=project_pk)
        return queryset.select_related('project', 'project__user')
    
    def perform_create(self, serializer):
        """Assign project from URL and verify ownership"""
        project_pk = self.kwargs.get('project_pk')

        if project_pk:            
            try:
                project = Project.objects.get(
                    id=project_pk,
                    user=self.request.user
                )
            except Project.DoesNotExist:
                raise PermissionDenied("Project not found or access denied.")
            serializer.save(project=project)
        else:
            serializer.save()


class SnippetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Snippet CRUD operations
    - Nested under /api/projects/{id}/snippets/
    - User isolation via project ownership
    """
    serializer_class = SnippetSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        """Returns only the snippet of the logged_in user"""
        project_pk = self.kwargs.get('project_pk')
        queryset = Snippet.objects.filter(project__user=self.request.user)

        if project_pk:
            queryset = queryset.filter(project__id=project_pk)
        return queryset.select_related('project', 'project__user')
    
    def perform_create(self, serializer):
        """Inject project from URL for nested routes"""
        project_pk = self.kwargs.get('project_pk')
        
        if project_pk:            
            try:
                project = Project.objects.get(
                    id=project_pk,
                    user=self.request.user
                )
            except Project.DoesNotExist:
                raise PermissionDenied("Project not found or access denied.")
            serializer.save(project=project)
        else:
            serializer.save()


class TODOViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Todo CRUD operations
    - Nested under /api/projects/{id}/todos/
    - User isolation via project ownership
    """
    serializer_class = TODOSerializer
    permission_classes = [IsAuthenticated, IsOwner]

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
        
        return queryset.select_related('project', 'project__user')
    
    def perform_create(self, serializer):
        """Inject project from URL for nested routes"""
        project_pk = self.kwargs.get('project_pk')

        if project_pk:
            try:
                project = Project.objects.get(
                    id=project_pk,
                    user=self.request.user
                )
            except Project.DoesNotExist:
                raise PermissionDenied('Project not found or access denied')
            serializer.save(project=project)
        else:
            serializer.save()

class SearchView(APIView):
    """
    Global search across Notes, Snippets and TODOs
    GET /api/search/?q=<query>&type=<notes|snippets|todos>
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q')
        search_type = request.query_params.get('type')

        if not query:
            return Response(
                {'error': 'Search query parameter "q" is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        VALID_TYPES = ['notes', 'snippets', 'todos']
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

        # Search in Notes
        if not search_type or search_type =='notes':
            notes = Note.objects.filter(project__user=user).filter(
                Q(title__icontains=query) | Q(content__icontains=query)
            )
            results['notes'] = NoteSerializer(notes, many=True).data

        # Search in Snippets
        if not search_type or search_type == 'snippets':
            snippets = Snippet.objects.filter(project__user=user).filter(
                Q(title__icontains=query) | Q(content__icontains=query)
            )
            results['snippets'] = SnippetSerializer(snippets, many=True).data

        # Search in TODOs
        if not search_type or search_type == 'todos':
            todos = TODO.objects.filter(project__user=user).filter(
                Q(title__icontains=query) | Q(description__icontains=query)
            )
            results['todos'] = TODOSerializer(todos, many=True).data

        return Response(results, status=status.HTTP_200_OK)
    