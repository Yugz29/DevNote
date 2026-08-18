from rest_framework import serializers
from .models import Project, Folder, Note, Snippet, TODO, TodoList
from .preview import note_preview


class ScopedFolderField(serializers.PrimaryKeyRelatedField):
    """Folder reference restricted to the folders of the requesting user."""

    def get_queryset(self):
        request = self.context.get('request')

        if request is None or not request.user.is_authenticated:
            return Folder.objects.none()

        return Folder.objects.filter(project__user=request.user)

class ScopedTodoListField(serializers.PrimaryKeyRelatedField):
    """Todo list reference restricted to the lists of the requesting user."""

    def get_queryset(self):
        request = self.context.get('request')

        if request is None or not request.user.is_authenticated:
            return TodoList.objects.none()

        return TodoList.objects.filter(project__user=request.user)


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for Project model"""
    class Meta:
        model = Project
        fields = [
            'id',
            'title',
            'description',
            'user',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def validate_title(self, value):
        """Validate and clean the project title"""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Project title cannot be empty.")
        return value
    
    def validate(self, data):
        """Check the uniqueness of the title for the user"""
        user = self.context['request'].user
        title = data.get('title')

        # Create the basic query
        if title:
            queryset = Project.objects.filter(user=user, title=title)

            if self.instance: # self.instance exists only in UPDATE
                queryset = queryset.exclude(id=self.instance.id)

            if queryset.exists():
                raise serializers.ValidationError(
                    f"The project '{title}' already exists"
                )
            
        return data


class FolderSerializer(serializers.ModelSerializer):
    """Serializer for Folder model"""
    project_id = serializers.UUIDField(read_only=True, source='project.id')
    parent = ScopedFolderField(allow_null=True, required=False)
    folder_count = serializers.SerializerMethodField()
    note_count = serializers.SerializerMethodField()

    class Meta:
        model = Folder
        fields = [
            'id',
            'name',
            'project_id',
            'parent',
            'folder_count',
            'note_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'project_id', 'created_at', 'updated_at']

    def get_folder_count(self, obj):
        count = getattr(obj, 'folder_count', None)
        return obj.children.count() if count is None else count

    def get_note_count(self, obj):
        count = getattr(obj, 'note_count', None)
        return obj.notes.count() if count is None else count

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Folder name cannot be empty.")
        return value

    def validate(self, data):
        project = (
            self.instance.project if self.instance
            else self.context.get('project')
        )
        parent = data.get(
            'parent',
            self.instance.parent if self.instance else None
        )
        name = data.get(
            'name',
            self.instance.name if self.instance else None
        )

        if parent is not None:
            if project is not None and parent.project_id != project.id:
                raise serializers.ValidationError(
                    {'parent': "Parent folder must belong to the same project."}
                )

            if self.instance is not None:
                if parent.id == self.instance.id:
                    raise serializers.ValidationError(
                        {'parent': "A folder cannot be its own parent."}
                    )

                if self.instance.id in parent.ancestor_ids():
                    raise serializers.ValidationError(
                        {'parent': "A folder cannot be its own ancestor."}
                    )

        if project is not None and name:
            siblings = Folder.objects.filter(
                project=project,
                parent=parent,
                name=name
            )

            if self.instance is not None:
                siblings = siblings.exclude(id=self.instance.id)

            if siblings.exists():
                raise serializers.ValidationError(
                    {'name': f"A folder named '{name}' already exists here."}
                )

        return data


class NoteSerializer(serializers.ModelSerializer):
    """Serializer for Note model"""
    project_id = serializers.UUIDField(read_only=True, source='project.id')
    folder = ScopedFolderField(allow_null=True, required=False)

    class Meta:
        model = Note
        fields = [
            'id',
            'title',
            'content',
            'project_id',
            'folder',
            'is_pinned',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'project_id', 'created_at', 'updated_at']

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Note title cannot be empty.")
        return value

    def validate(self, data):
        project = (
            self.instance.project if self.instance
            else self.context.get('project')
        )
        folder = data.get(
            'folder',
            self.instance.folder if self.instance else None
        )

        if folder is not None and project is not None and folder.project_id != project.id:
            raise serializers.ValidationError(
                {'folder': "Folder must belong to the same project as the note."}
            )

        return data


class NoteCardSerializer(serializers.ModelSerializer):
    """
    Note as shown in the gallery: carries a plain-text excerpt instead of the
    whole Markdown, which a listing never renders.
    """
    project_id = serializers.UUIDField(read_only=True, source='project.id')
    folder = serializers.PrimaryKeyRelatedField(read_only=True)
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Note
        fields = [
            'id',
            'title',
            'preview',
            'project_id',
            'folder',
            'is_pinned',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_preview(self, obj):
        return note_preview(obj.content)


class SnippetSerializer(serializers.ModelSerializer):
    """Serializer for Snippet model"""
    project_id = serializers.UUIDField(read_only=True, source='project.id')

    class Meta:
        model = Snippet
        fields = [
            'id',
            'title',
            'content',
            'language',
            'description',
            'project_id',
            'is_pinned',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'project_id', 'created_at', 'updated_at']

    def validate_title(self, value):
        """Title cannot be empty or whitespace only"""
        if not value or not value.strip():
            raise serializers.ValidationError('Title cannot be empty or whitespace only')
        return value.strip()
    
    def validate_content(self, value):
        """Content cannot be empty"""
        if not value or not value.strip():
            raise serializers.ValidationError('Content cannot be empty')
        return value.strip()
    
    def validate_language(self, value):
        """
        Validate and normalize language field
        Todo : Add auto_detection from content
        """
        if not value or not value.strip():
            return 'text'
        return value.strip().lower()


class TodoListSerializer(serializers.ModelSerializer):
    """Serializer for TodoList model"""
    project_id = serializers.UUIDField(read_only=True, source='project.id')
    todo_count = serializers.SerializerMethodField()

    class Meta:
        model = TodoList
        fields = [
            'id',
            'name',
            'project_id',
            'is_permanent',
            'todo_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'project_id', 'is_permanent', 'created_at', 'updated_at'
        ]

    def get_todo_count(self, obj):
        count = getattr(obj, 'todo_count', None)
        return obj.todos.count() if count is None else count

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("List name cannot be empty.")
        return value

    def validate(self, data):
        project = (
            self.instance.project if self.instance
            else self.context.get('project')
        )
        name = data.get('name', self.instance.name if self.instance else None)

        if project is not None and name:
            siblings = TodoList.objects.filter(project=project, name=name)

            if self.instance is not None:
                siblings = siblings.exclude(id=self.instance.id)

            if siblings.exists():
                raise serializers.ValidationError(
                    {'name': f"A list named '{name}' already exists here."}
                )

        return data


class TODOSerializer(serializers.ModelSerializer):
    """Serializer for Todo objects"""
    project_id = serializers.UUIDField(read_only=True, source='project.id')
    list = ScopedTodoListField(allow_null=True, required=False)

    class Meta:
        model = TODO
        fields = [
            'id',
            'title',
            'description',
            'status',
            'priority',
            'project_id',
            'list',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'project_id', 'created_at', 'updated_at']

    def validate_title(self, value):
        """Title cannot be empty or whitespace only"""
        if not value or not value.strip():
            raise serializers.ValidationError('Title cannot be empty or whitespace only')
        return value.strip()

    def validate(self, data):
        project = (
            self.instance.project if self.instance
            else self.context.get('project')
        )
        todo_list = data.get(
            'list',
            self.instance.list if self.instance else None
        )

        if todo_list is not None and project is not None and todo_list.project_id != project.id:
            raise serializers.ValidationError(
                {'list': "List must belong to the same project as the TODO."}
            )

        return data
