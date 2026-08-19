from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator
from django.db import models
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
        help_text="Unique identifier UUIDv7",
    )

    title = models.CharField(max_length=255, help_text="Name of the project")

    description = models.TextField(
        blank=True,
        default="",
        validators=[MaxLengthValidator(5000)],
        help_text="Description of the project",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects",
        help_text="Owner of the project",
    )

    created_at = models.DateTimeField(
        auto_now_add=True, help_text="Project creation date"
    )

    updated_at = models.DateTimeField(
        auto_now=True, help_text="Date of last modification"
    )

    class Meta:
        db_table = "devnote_projects"
        verbose_name = "Project"
        verbose_name_plural = "Projects"
        ordering = ["-created_at"]

        constraints = [
            models.UniqueConstraint(
                fields=["user", "title"], name="unique_project_per_user"
            )
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return self.title


class Folder(models.Model):
    """
    Folder model represents a folder holding notes inside a project.
    Folders nest without depth limit; a null parent means project root.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        help_text="Unique identifier UUIDv7",
    )

    name = models.CharField(max_length=255, help_text="Name of the folder")

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="folders",
        help_text="Folder associated to project",
    )

    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        help_text="Parent folder, null for a folder at the project root",
    )

    created_at = models.DateTimeField(
        auto_now_add=True, help_text="Folder creation date"
    )

    updated_at = models.DateTimeField(
        auto_now=True, help_text="Date of last modification"
    )

    class Meta:
        db_table = "devnote_folders"
        verbose_name = "Folder"
        verbose_name_plural = "Folders"
        ordering = ["name"]

        constraints = [
            models.UniqueConstraint(
                fields=["project", "parent", "name"],
                condition=models.Q(parent__isnull=False),
                name="unique_folder_name_in_parent",
            ),
            models.UniqueConstraint(
                fields=["project", "name"],
                condition=models.Q(parent__isnull=True),
                name="unique_folder_name_at_root",
            ),
        ]
        indexes = [
            models.Index(fields=["project", "parent"]),
        ]

    def __str__(self):
        return self.name

    def ancestor_ids(self):
        """Ids of every ancestor, closest first."""
        ids = []
        seen = set()
        node = self.parent

        while node is not None and node.id not in seen:
            ids.append(node.id)
            seen.add(node.id)
            node = node.parent

        return ids

    def descendant_ids(self):
        """Ids of every nested folder below this one."""
        ids = []
        frontier = [self.id]

        while frontier:
            frontier = list(
                Folder.objects.filter(parent_id__in=frontier)
                .exclude(id__in=ids)
                .values_list("id", flat=True)
            )
            ids.extend(frontier)

        return ids

    def cascade_counts(self):
        """What a recursive delete of this folder would remove."""
        folder_ids = self.descendant_ids()

        return {
            "folders": len(folder_ids),
            "notes": Note.objects.filter(folder_id__in=[self.id, *folder_ids]).count(),
        }

    def is_empty(self):
        counts = self.cascade_counts()
        return counts["folders"] == 0 and counts["notes"] == 0

    def clean(self):
        super().clean()

        if self.parent_id is None:
            return

        if self.parent_id == self.id:
            raise ValidationError({"parent": "A folder cannot be its own parent."})

        if self.parent.project_id != self.project_id:
            raise ValidationError(
                {"parent": "Parent folder must belong to the same project."}
            )

        if self.id in self.parent.ancestor_ids():
            raise ValidationError({"parent": "A folder cannot be its own ancestor."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Note(models.Model):
    """
    Note model represents a note linked to a project.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        help_text="Unique identifier UUIDv7",
    )

    title = models.CharField(max_length=255, help_text="Title of the note")

    content = models.TextField(
        blank=True,
        default="",
        validators=[MaxLengthValidator(100000)],
        help_text="Content of the note",
    )

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="notes",
        help_text="Note associated to project",
    )

    folder = models.ForeignKey(
        Folder,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notes",
        help_text="Folder holding the note, null for a note at the project root",
    )

    is_pinned = models.BooleanField(
        default=False, help_text="Whether the note is pinned for quick access"
    )

    created_at = models.DateTimeField(auto_now_add=True, help_text="Note creation date")

    updated_at = models.DateTimeField(
        auto_now=True, help_text="Date of last modification"
    )

    class Meta:
        db_table = "devnote_notes"
        verbose_name = "Note"
        verbose_name_plural = "Notes"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "-created_at"]),
            models.Index(fields=["folder", "-created_at"]),
            models.Index(fields=["project", "is_pinned"]),
        ]

    def __str__(self):
        return self.title


class Snippet(models.Model):
    """Snippet model represents a snippet linked to a project"""

    id = models.UUIDField(
        primary_key=True, default=uuid7, editable=False, help_text="Unique identifier"
    )
    title = models.CharField(max_length=255, help_text="Title of the snippet")
    content = models.TextField(help_text="Content of the snippet")
    language = models.CharField(
        max_length=50, default="text", help_text="Language of the snippet"
    )
    description = models.TextField(
        blank=True, default="", help_text="Description of the snippet"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="snippets",
        help_text="Snippet associated to project",
    )
    is_pinned = models.BooleanField(
        default=False, help_text="Whether the snippet is pinned for quick access"
    )
    created_at = models.DateTimeField(
        auto_now_add=True, help_text="Date creation of snippet"
    )
    updated_at = models.DateTimeField(
        auto_now=True, help_text="Date of last modification"
    )

    class Meta:
        db_table = "devnote_snippets"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "-created_at"]),
            models.Index(fields=["project", "is_pinned"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.language})"


class TodoList(models.Model):
    """
    TodoList model represents a flat list holding todos inside a project.
    Lists never nest: a todo belongs to at most one of them.

    Every project owns exactly one permanent list, created with it and
    refused to deletion, though its name is the user's to change.
    """

    PERMANENT_NAME = "Top priorities"

    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        help_text="Unique identifier UUIDv7",
    )

    name = models.CharField(max_length=255, help_text="Name of the list")

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="todo_lists",
        help_text="List associated to project",
    )

    is_permanent = models.BooleanField(
        default=False, help_text="Whether this list is built in and cannot be deleted"
    )

    created_at = models.DateTimeField(auto_now_add=True, help_text="List creation date")

    updated_at = models.DateTimeField(
        auto_now=True, help_text="Date of last modification"
    )

    class Meta:
        db_table = "devnote_todo_lists"
        verbose_name = "TODO list"
        verbose_name_plural = "TODO lists"
        ordering = ["-is_permanent", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"], name="unique_todo_list_name_in_project"
            ),
            models.UniqueConstraint(
                fields=["project"],
                condition=models.Q(is_permanent=True),
                name="unique_permanent_list_in_project",
            ),
        ]
        indexes = [
            models.Index(fields=["project", "name"]),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @classmethod
    def ensure_permanent(cls, project):
        """The permanent list of a project, created if it is missing."""
        existing = cls.objects.filter(project=project, is_permanent=True).first()

        if existing is not None:
            return existing

        return cls.objects.create(
            name=cls.PERMANENT_NAME, project=project, is_permanent=True
        )


class TODO(models.Model):
    """
    Represents a task/Todo item linked to a project.
    Tracks status (pending/in_progress/done) and priority (low/medium/high)
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("done", "Done"),
    ]

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    title = models.CharField(max_length=255, help_text="Title of the TODO")
    description = models.TextField(
        blank=True, default="", help_text="Optional description"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Current status of the TODO",
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default="medium",
        help_text="Priority level",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="todos",
        help_text="Associated project",
    )
    list = models.ForeignKey(
        TodoList,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="todos",
        help_text="List holding the TODO, null for an unclassified TODO",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "devnote_todos"
        ordering = ["-created_at"]
        verbose_name = "TODO"
        verbose_name_plural = "TODOs"
        indexes = [
            models.Index(fields=["project", "-created_at"]),
            models.Index(fields=["project", "list"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"
