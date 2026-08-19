import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0008_backfill_permanent_lists"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="Note",
            new_name="Document",
        ),
        migrations.AlterModelOptions(
            name="document",
            options={
                "ordering": ["-created_at"],
                "verbose_name": "Document",
                "verbose_name_plural": "Documents",
            },
        ),
        migrations.AlterModelTable(
            name="document",
            table="devnote_documents",
        ),
        migrations.RenameIndex(
            model_name="document",
            new_name="devnote_doc_project_c16684_idx",
            old_name="devnote_not_project_9c12cc_idx",
        ),
        migrations.RenameIndex(
            model_name="document",
            new_name="devnote_doc_folder__f63859_idx",
            old_name="devnote_not_folder__43e91d_idx",
        ),
        migrations.RenameIndex(
            model_name="document",
            new_name="devnote_doc_project_333e68_idx",
            old_name="devnote_not_project_284c68_idx",
        ),
        migrations.AlterField(
            model_name="document",
            name="title",
            field=models.CharField(
                help_text="Title of the document", max_length=255
            ),
        ),
        migrations.AlterField(
            model_name="document",
            name="content",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Content of the document",
                validators=[django.core.validators.MaxLengthValidator(100000)],
            ),
        ),
        migrations.AlterField(
            model_name="document",
            name="project",
            field=models.ForeignKey(
                help_text="Document associated to project",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="documents",
                to="workspace.project",
            ),
        ),
        migrations.AlterField(
            model_name="document",
            name="folder",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Folder holding the document, null for a document "
                    "at the project root"
                ),
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="documents",
                to="workspace.folder",
            ),
        ),
        migrations.AlterField(
            model_name="document",
            name="is_pinned",
            field=models.BooleanField(
                default=False,
                help_text="Whether the document is pinned for quick access",
            ),
        ),
        migrations.AlterField(
            model_name="document",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True, help_text="Document creation date"
            ),
        ),
    ]
