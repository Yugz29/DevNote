from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Modèle User personnalisé pour DevNote.
    
    Hérite de AbstractUser (inclut username, email, password, etc.).
    Ajouter des champs custom plus tard (avatar, bio, etc.).
    
    Pour l'instant, on garde les champs par défaut de Django :
    - username (unique, requis)
    - email (optionnel par défaut, mais on le rendra requis dans le serializer)
    - password (hashé automatiquement par Django)
    - first_name, last_name (optionnels)
    - is_active, is_staff, is_superuser (flags d'autorisation)
    - date_joined (timestamp de création)
    """

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
