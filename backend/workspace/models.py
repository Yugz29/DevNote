from django.db import models
from django.conf import settings
from uuid6 import uuid7
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator


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

    title = models.CharField(
        max_length=255,
        help_text="Name of the project"
    )

    description = models.TextField(
        blank=True,
        default="",
        validators=[MaxLengthValidator(5000)],
        help_text="Description of the project"
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

        constraints = [
            models.UniqueConstraint(
                fields=['user', 'title'],
                name='unique_project_per_user'
            )
        ]
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return self.title


class Note(models.Model):
    """
    Note model represents a note linked to a project.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        help_text="Unique identifier UUIDv7"
    )

    title = models.CharField(
        max_length=255,
        help_text="Title of the note"
    )

    content = models.TextField(
        blank=True,
        default="",
        validators=[MaxLengthValidator(100000)],
        help_text="Content of the note"
    )

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='notes',
        help_text="Note associated to project"
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Note creation date"
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Date of last modification"
    )

    class Meta:
        db_table = 'devnote_notes'
        verbose_name = 'Note'
        verbose_name_plural = 'Notes'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', '-created_at']),
        ]

    def __str__(self):
        return self.title


class Snippet(models.Model):
    """Snippet model represents a snippet linked to a project"""
    id = models.UUIDField(primary_key=True, default=uuid7, editable=False, help_text="Unique identifier")
    title = models.CharField(max_length=255, help_text="Title of the snippet")
    content = models.TextField(help_text="Content of the snippet")
    language = models.CharField(max_length=50, default='text', help_text="Language of the snippet")
    description = models.TextField(blank=True, default='', help_text="Description of the snippet")
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='snippets',
        help_text="Snippet associated to project"
    )
    created_at = models.DateTimeField(auto_now_add=True, help_text="Date creation of snippet")
    updated_at = models.DateTimeField(auto_now=True, help_text="Date of last modification")

    class Meta:
        db_table = 'devnote_snippets'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', '-created_at']),
        ]

    def __str__(self):
        return f'{self.title} ({self.language})'


class TODO(models.Model):
    """
    Represents a task/Todo item linked to a project.
    Tracks status (pending/in_progress/done) and priority (low/medium/high)
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('done', 'Done'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    title = models.CharField(max_length=255, help_text='Title of the TODO')
    description = models.TextField(blank=True, default='', help_text='Optional description')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text='Current status of the TODO'
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='medium',
        help_text='Priority level'
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='todos',
        help_text='Associated project'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'devnote_todos'
        ordering = ['-created_at']
        verbose_name = 'TODO'
        verbose_name_plural = 'TODOs'
        indexes = [
            models.Index(fields=['project', '-created_at']),
        ]

    def __str__(self):
        return f'{self.title} ({self.get_status_display()})'
