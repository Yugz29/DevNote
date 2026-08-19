from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers as nested_routers

from .views import (
    DocumentViewSet,
    FolderViewSet,
    ProjectViewSet,
    SearchView,
    SnippetViewSet,
    TodoListViewSet,
    TODOViewSet,
)

# Main router
router = DefaultRouter()
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"folders", FolderViewSet, basename="folder")
router.register(r"documents", DocumentViewSet, basename="document")
router.register(r"snippets", SnippetViewSet, basename="snippet")
router.register(r"todo-lists", TodoListViewSet, basename="todo-list")
router.register(r"todos", TODOViewSet, basename="todo")

# Router for nested routes
projects_router = nested_routers.NestedDefaultRouter(
    router, r"projects", lookup="project"
)
projects_router.register(r"folders", FolderViewSet, basename="project-folders")
projects_router.register(r"documents", DocumentViewSet, basename="project-documents")
projects_router.register(r"snippets", SnippetViewSet, basename="project-snippets")
projects_router.register(r"todo-lists", TodoListViewSet, basename="project-todo-lists")
projects_router.register(r"todos", TODOViewSet, basename="project-todos")

urlpatterns = [
    path("", include(router.urls)),
    path("", include(projects_router.urls)),
    path("search/", SearchView.as_view(), name="search"),
]
