from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from .managers import UserManager
from uuid6 import uuid7
import uuid


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
        help_text="Unique identifier UUIDv7"
    )

    username = models.CharField(
        max_length=150,
        unique=True,
        blank=True,
        null=True,
        help_text='Username (optional)'
    )

    email = models.EmailField(
        unique=True,
        blank=False,
        help_text='User email address (unique, required)'
    )

    first_name = models.CharField(
        max_length=150,
        blank=False,
        help_text='User first name (required)'
    )

    last_name = models.CharField(
        max_length=150,
        blank=False,
        help_text='User last name (required)'
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Account creation date"
        )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Date of last modification"
        )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UserManager()

    class Meta:
        db_table = 'devnote_users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return self.email
