from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers as nested_routers
from .views import ProjectViewSet, NoteViewSet, SnippetViewSet, TODOViewSet, SearchView

# Main router
router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'notes', NoteViewSet, basename='note')
router.register(r'snippets', SnippetViewSet, basename='snippet')
router.register(r'todos', TODOViewSet, basename='todo')

# Router for nested notes
projects_router = nested_routers.NestedDefaultRouter(
    router,
    r'projects',
    lookup='project'
)
projects_router.register(r'notes', NoteViewSet, basename='project-notes')
projects_router.register(r'snippets', SnippetViewSet, basename='project-snippets')
projects_router.register(r'todos', TODOViewSet, basename='project-todos')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(projects_router.urls)),
    path('search/', SearchView.as_view(), name='search'),
]
