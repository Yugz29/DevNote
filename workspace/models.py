from django.db import models
from django.conf import settings
from uuid6 import uuid7

class Project(models.Model):
    """
    Modèle Project représente un projet appartenant à un utilisateur.
    Utilisation de UUIDv7 comme PK pour une meilleure performance en indexation
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        help_text="Unique identifier UUIDv7"
    )

    name = models.CharField(
        max_length=255,
        help_text="Name of the project"
    )

    description = models.TextField(
        blank=True,
        default=""
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects',
        help_text="Owner of the project"
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Project creation date"
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Date of last modification"
    )

    class Meta:
        db_table = 'devnote_projects'
        verbose_name = 'Project'
        verbose_name_plural = 'Projects'
        ordering = ['-created_at']

    def __str__(self):
        return self.name
