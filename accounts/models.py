from django.contrib.auth.models import AbstractUser
from django.db import models
from uuid6 import uuid7

class User(AbstractUser):
    """
    Modèle User personnalisé pour DevNote.
    
    Hérite de AbstractUser (inclut username, email, password, etc.)
    Ajouter des champs custom plus tard (avatar, bio, etc.)
    Utilisation de UUIDv7 comme PK pour une meilleure performance en indexation
    
    Pour l'instant, on garde les champs par défaut de Django :
    - username (unique, requis)
    - email (optionnel par défaut, mais on le rendra requis dans le serializer)
    - password (hashé automatiquement par Django)
    - first_name, last_name (optionnels)
    - is_active, is_staff, is_superuser (flags d'autorisation)
    - date_joined (timestamp de création)
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        help_text="Unique identifier UUIDv7"
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Account creation date"
        )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Date of last modification"
        )

    class Meta:
        db_table = 'devnote_users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return self.username
