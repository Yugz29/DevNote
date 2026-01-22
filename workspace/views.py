from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated
from .models import Project
from .serializers import ProjectSerializer


class IsOwner(permissions.BasePermission):
    """
    Custom permission: verifies that the logged-in user
    is the owner of the object (via the 'user' attribute).
    Can be used on Project, Note, Snippet, Todo.
    """

    def has_object_permission(self, request, view, obj):
        return hasattr(obj, 'user') and obj.user == request.user


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        """Returns only the projects of the logged-in user"""
        return Project.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Automatically associate the project with the logged-in user"""
        serializer.save(user=self.request.user)
