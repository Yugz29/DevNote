# accounts/managers.py
import uuid

from django.contrib.auth.models import BaseUserManager
from django.db import models
from django.utils import timezone

from .tokens import generate_token, hash_token


class UserManager(BaseUserManager):
    """
    Custom manager for User.

    Allows you to create users with email as USERNAME_FIELD
    instead of username.
    """

    def create_user(self, email, password=None, **extra_fields):
        """
        Creates and saves a normal user.

        Args:
            email (str): User's email address (required)
            password (str): Password
            **extra_fields: first_name, last_name, username (optional)
        """
        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)

        # Autogeneration of the username if not provided
        username = extra_fields.get("username")
        if not username:
            username = f"user_{uuid.uuid4().hex[:10]}"
            extra_fields["username"] = username

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Creates and saves a Superuser.

        Args:
            email (str): Superuser email address
            password (str): Password
            **extra_fields: first_name, last_name, etc.
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email, password, **extra_fields)


class ApiTokenManager(models.Manager):
    """Manager for ApiToken, holding the mint and lookup paths."""

    def create_token(self, user, name, expires_at=None):
        """
        Mint a token for a user. Returns the row and the raw secret, which is
        the only moment the secret exists outside the caller's hands.
        """
        raw_token, prefix = generate_token()

        token = self.create(
            user=user,
            name=name,
            prefix=prefix,
            token_hash=hash_token(raw_token),
            expires_at=expires_at,
        )

        return token, raw_token

    def resolve(self, raw_token):
        """The token matching a raw secret, or None when nothing matches."""
        return (
            self.select_related("user").filter(token_hash=hash_token(raw_token)).first()
        )

    def active(self):
        """Tokens that still authenticate, expired ones left out."""
        return self.filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
        )
