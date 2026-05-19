from django.urls import path
from .views import (
    CSRFTokenView,
    RegisterView, 
    LoginView, 
    UserDetailView, 
    LogoutView, 
    RefreshView,
)

urlpatterns = [
    path('csrf/', CSRFTokenView.as_view(), name='csrf-token'),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('me/', UserDetailView.as_view(), name='user-detail'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('refresh/', RefreshView.as_view(), name='refresh'),
]
