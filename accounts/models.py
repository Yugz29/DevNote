from django.contrib.auth.models import AbstractUser
from django.db import models
from uuid6 import uuid7

class User(AbstractUser):
    """
    Modèle User personnalisé pour DevNote.
    
    Hérite de AbstractUser (inclut username, email, password, etc.)
    Ajouter des champs custom plus tard (avatar, bio, etc.)
    Utilisation de UUIDv7 comme PK pour une meilleure performance en indexation
    
    Modification par rapport au mode par défaut de Django :
    - username facultatif (peut être null)
    - email obligatoire et unique
    - password (hashé automatiquement par Django)
    - first_name obligatoire
    - last_name obligatoire
    UUIDv7 comme PK pour une meilleure performance en indexation
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

    class Meta:
        db_table = 'devnote_users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return self.username
