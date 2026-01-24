from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import Project, Note
from .serializers import ProjectSerializer, NoteSerializer


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
            # Nested route: porject from URL
            
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