from django.urls import path

from .views import (
    ChangePasswordView,
    CSRFTokenView,
    DeleteAccountView,
    LoginView,
    LogoutView,
    RefreshView,
    RegisterView,
    UserDetailView,
)

urlpatterns = [
    path("csrf/", CSRFTokenView.as_view(), name="csrf-token"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("me/", UserDetailView.as_view(), name="user-detail"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("password/", ChangePasswordView.as_view(), name="change-password"),
    path("account/delete/", DeleteAccountView.as_view(), name="delete-account"),
]
