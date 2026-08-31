from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from uuid6 import uuid7

from .managers import ApiTokenManager, UserManager


class User(AbstractUser):
    """
    Custom User model for DevNote.

    Inherits from AbstractUser (includes username, email, password, etc.)
    Add custom fields later (avatar, bio, etc.)
    Uses UUIDv7 as PK for better indexing performance

    Changes from Django's default mode:
    - Optional username (can be null)
    - email required and unique
    - password (automatically hashed by Django)
    - first_name required
    - last_name required
    UUIDv7 as PK for better indexing performance
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        help_text="Unique identifier UUIDv7",
    )

    username = models.CharField(
        max_length=150,
        unique=True,
        blank=True,
        null=True,
        help_text="Username (optional)",
    )

    email = models.EmailField(
        unique=True, blank=False, help_text="User email address (unique, required)"
    )

    first_name = models.CharField(
        max_length=150, blank=False, help_text="User first name (required)"
    )

    last_name = models.CharField(
        max_length=150, blank=False, help_text="User last name (required)"
    )

    created_at = models.DateTimeField(
        auto_now_add=True, help_text="Account creation date"
    )

    updated_at = models.DateTimeField(
        auto_now=True, help_text="Date of last modification"
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        db_table = "devnote_users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.email


class ApiToken(models.Model):
    """
    A personal API token, for programmatic clients rather than browsers.

    Browsers authenticate with the short-lived JWT pair held in HttpOnly
    cookies, which no headless client can renew on its own. A token is the
    other half of that story: long-lived, carried in the Authorization
    header, tied to one user, and revoked by deleting the row.

    Only the digest is stored. The raw secret is returned once at creation
    and cannot be recovered afterwards.
    """

    LAST_USED_RESOLUTION = timedelta(minutes=1)

    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        help_text="Unique identifier UUIDv7",
    )

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="api_tokens",
        help_text="Owner of the token",
    )

    name = models.CharField(
        max_length=100, help_text="Label telling the owner what uses this token"
    )

    prefix = models.CharField(
        max_length=16,
        help_text="First characters of the secret, kept in clear for display",
    )

    token_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="SHA-256 digest of the raw token",
    )

    created_at = models.DateTimeField(auto_now_add=True, help_text="Token issue date")

    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time the token authenticated a request, null if never used",
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Date the token stops working, null for a token that never expires",
    )

    objects = ApiTokenManager()

    class Meta:
        db_table = "devnote_api_tokens"
        verbose_name = "API token"
        verbose_name_plural = "API tokens"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"], name="unique_api_token_name_per_user"
            )
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.prefix}…)"

    def is_expired(self):
        return self.expires_at is not None and self.expires_at <= timezone.now()

    def touch(self):
        """
        Record the token as used, at a one-minute resolution so a busy client
        does not turn every read into a write.
        """
        now = timezone.now()

        if (
            self.last_used_at is not None
            and now - self.last_used_at < self.LAST_USED_RESOLUTION
        ):
            return

        self.last_used_at = now
        ApiToken.objects.filter(pk=self.pk).update(last_used_at=now)
