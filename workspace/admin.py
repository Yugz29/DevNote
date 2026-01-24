from django.contrib import admin
from .models import Project, Note

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'description', 'user', 'created_at')
    search_fields = ('title', 'description')
    list_filter = ('created_at', 'updated_at')
    readonly_fields = ('id', 'created_at', 'updated_at')

@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'project', 'created_at')
    search_fields = ('title', 'content')
    list_filter = ('created_at', 'updated_at', 'project')
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('project',)
