from django.db import migrations

PERMANENT_NAME = "Top priorities"


def create_permanent_lists(apps, schema_editor):
    Project = apps.get_model("workspace", "Project")
    TodoList = apps.get_model("workspace", "TodoList")

    missing = Project.objects.exclude(todo_lists__is_permanent=True)

    for project in missing:
        name = PERMANENT_NAME
        suffix = 2

        while TodoList.objects.filter(project=project, name=name).exists():
            name = f"{PERMANENT_NAME} ({suffix})"
            suffix += 1

        TodoList.objects.create(name=name, project=project, is_permanent=True)


def drop_permanent_lists(apps, schema_editor):
    TodoList = apps.get_model("workspace", "TodoList")
    TodoList.objects.filter(is_permanent=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0007_alter_todolist_options_todolist_is_permanent_and_more"),
    ]

    operations = [
        migrations.RunPython(create_permanent_lists, drop_permanent_lists),
    ]
