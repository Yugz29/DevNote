from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Project, TodoList


@receiver(post_save, sender=Project)
def create_permanent_list(sender, instance, created, **kwargs):
    if not created:
        return

    TodoList.ensure_permanent(instance)
