from django.db import migrations


def release_permanent_lists(apps, schema_editor):
    """
    Hand the todos of every permanent list back to the project, then drop the
    lists themselves. A todo with no list is what the UI shows under "All",
    so nothing is lost: the todos simply stop being grouped.
    """
    TodoList = apps.get_model("workspace", "TodoList")
    TODO = apps.get_model("workspace", "TODO")

    permanent = TodoList.objects.filter(is_permanent=True)

    TODO.objects.filter(list__in=permanent).update(list=None)
    permanent.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0010_todo_is_pinned_todo_devnote_tod_project_1a192b_idx"),
    ]

    operations = [
        # Not reversible in substance: recreating the lists would be easy, but
        # nothing records which todos used to sit in them.
        migrations.RunPython(release_permanent_lists, migrations.RunPython.noop),
    ]
