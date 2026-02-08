from django.contrib import admin
from django.utils.html import format_html
from .models import Project, Note, Snippet, TODO


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    """
    Admin interface for Project model
    - Display key fields with user info
    - Search by title/description
    - Filter by dates
    """
    list_display = ('id', 'title', 'user_link', 'items_count', 'created_at', 'updated_at')
    search_fields = ('title', 'description', 'user__username', 'user__email')
    list_filter = ('created_at', 'updated_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'items_summary')
    raw_id_fields = ('user',)
    
    def user_link(self, obj):
        """Display user as clickable link"""
        return format_html(
            '<a href="/admin/accounts/user/{}/change/">{}</a>',
            obj.user.id,
            obj.user.username
        )
    user_link.short_description = 'Owner'
    
    def items_count(self, obj):
        """Display count of notes, snippets, and todos"""
        notes = obj.notes.count()
        snippets = obj.snippets.count()
        todos = obj.todos.count()
        total = notes + snippets + todos
        
        return format_html(
            '<span title="Notes: {} | Snippets: {} | TODOs: {}">{} items</span>',
            notes, snippets, todos, total
        )
    items_count.short_description = 'Content'
    
    def items_summary(self, obj):
        """Detailed summary in readonly field"""
        notes = obj.notes.count()
        snippets = obj.snippets.count()
        todos = obj.todos.count()
        
        return f"📝 {notes} notes | 💻 {snippets} snippets | ✅ {todos} todos"
    items_summary.short_description = 'Project Summary'


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    """
    Admin interface for Note model
    - Display with project context
    - Search in title and content
    - Filter by project and dates
    """
    list_display = ('id', 'title', 'project_link', 'preview', 'created_at', 'updated_at')
    search_fields = ('title', 'content', 'project__title')
    list_filter = ('created_at', 'updated_at', 'project')
    readonly_fields = ('id', 'created_at', 'updated_at', 'content_length')
    raw_id_fields = ('project',)
    
    def project_link(self, obj):
        """Display project as clickable link"""
        return format_html(
            '<a href="/admin/workspace/project/{}/change/">{}</a>',
            obj.project.id,
            obj.project.title
        )
    project_link.short_description = 'Project'
    
    def preview(self, obj):
        """Show content preview (first 50 chars)"""
        content = obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
        return format_html('<span style="color: #6C757D;">{}</span>', content)
    preview.short_description = 'Preview'
    
    def content_length(self, obj):
        """Display content length"""
        return f"{len(obj.content)} characters"
    content_length.short_description = 'Content Length'


@admin.register(Snippet)
class SnippetAdmin(admin.ModelAdmin):
    """
    Admin interface for Snippet model
    - Display with language badge
    - Search in code and description
    - Filter by language and project
    """
    list_display = ('id', 'title', 'language_badge', 'project_link', 'created_at', 'updated_at')
    search_fields = ('title', 'content', 'language', 'description', 'project__title')
    list_filter = ('language', 'created_at', 'updated_at', 'project')
    readonly_fields = ('id', 'created_at', 'updated_at', 'code_stats')
    raw_id_fields = ('project',)
    
    def project_link(self, obj):
        """Display project as clickable link"""
        return format_html(
            '<a href="/admin/workspace/project/{}/change/">{}</a>',
            obj.project.id,
            obj.project.title
        )
    project_link.short_description = 'Project'
    
    def language_badge(self, obj):
        """Display language with color badge"""
        colors = {
            'python': '#3776AB',
            'javascript': '#F7DF1E',
            'java': '#007396',
            'c': '#A8B9CC',
            'cpp': '#00599C',
            'csharp': '#239120',
            'ruby': '#CC342D',
            'go': '#00ADD8',
            'rust': '#000000',
            'php': '#777BB4',
            'swift': '#FA7343',
            'kotlin': '#7F52FF',
            'typescript': '#3178C6',
            'html': '#E34F26',
            'css': '#1572B6',
            'sql': '#4479A1',
            'bash': '#4EAA25',
            'text': '#6C757D',
        }
        color = colors.get(obj.language.lower(), '#6C757D')
        text_color = 'black' if obj.language.lower() in ['javascript'] else 'white'
        
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 3px 10px; border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            text_color,
            obj.language.upper()
        )
    language_badge.short_description = 'Language'
    
    def code_stats(self, obj):
        """Display code statistics"""
        lines = obj.content.count('\n') + 1
        chars = len(obj.content)
        return f"{lines} lines | {chars} characters"
    code_stats.short_description = 'Code Stats'


@admin.register(TODO)
class TODOAdmin(admin.ModelAdmin):
    """
    Admin interface for TODO model
    - Display with status and priority badges
    - Quick filters for workflow management
    - Bulk actions for status updates
    """
    list_display = ('id', 'title', 'project_link', 'status_badge', 'priority_badge', 'created_at', 'updated_at')
    search_fields = ('title', 'description', 'project__title')
    list_filter = ('status', 'priority', 'created_at', 'updated_at', 'project')
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('project',)
    actions = ['mark_as_pending', 'mark_as_in_progress', 'mark_as_done']
    
    def project_link(self, obj):
        """Display project as clickable link"""
        return format_html(
            '<a href="/admin/workspace/project/{}/change/">{}</a>',
            obj.project.id,
            obj.project.title
        )
    project_link.short_description = 'Project'
    
    def status_badge(self, obj):
        """Display status with color badge"""
        colors = {
            'pending': '#FFA500',      # Orange
            'in_progress': '#007BFF',  # Blue
            'done': '#28A745',         # Green
        }
        icons = {
            'pending': '⏳',
            'in_progress': '🔄',
            'done': '✅',
        }
        color = colors.get(obj.status, '#6C757D')
        icon = icons.get(obj.status, '❓')
        
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-weight: bold;">{} {}</span>',
            color,
            icon,
            obj.get_status_display().upper()
        )
    status_badge.short_description = 'Status'
    
    def priority_badge(self, obj):
        """Display priority with color badge"""
        colors = {
            'low': '#6C757D',     # Gray
            'medium': '#FFC107',  # Yellow
            'high': '#DC3545',    # Red
        }
        icons = {
            'low': '🔽',
            'medium': '➡️',
            'high': '🔺',
        }
        color = colors.get(obj.priority, '#6C757D')
        icon = icons.get(obj.priority, '❓')
        text_color = 'black' if obj.priority == 'medium' else 'white'
        
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 3px 10px; border-radius: 3px; font-weight: bold;">{} {}</span>',
            color,
            text_color,
            icon,
            obj.get_priority_display().upper()
        )
    priority_badge.short_description = 'Priority'
    
    # Bulk actions
    def mark_as_pending(self, request, queryset):
        """Bulk action: Mark selected TODOs as pending"""
        updated = queryset.update(status='pending')
        self.message_user(request, f'{updated} TODO(s) marked as pending.')
    mark_as_pending.short_description = '⏳ Mark as Pending'
    
    def mark_as_in_progress(self, request, queryset):
        """Bulk action: Mark selected TODOs as in progress"""
        updated = queryset.update(status='in_progress')
        self.message_user(request, f'{updated} TODO(s) marked as in progress.')
    mark_as_in_progress.short_description = '🔄 Mark as In Progress'
    
    def mark_as_done(self, request, queryset):
        """Bulk action: Mark selected TODOs as done"""
        updated = queryset.update(status='done')
        self.message_user(request, f'{updated} TODO(s) marked as done.')
    mark_as_done.short_description = '✅ Mark as Done'
