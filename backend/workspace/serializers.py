from rest_framework import serializers
from .models import Project, Note, Snippet, TODO

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


class NoteSerializer(serializers.ModelSerializer):
    """Serializer for Note model"""
    project_id = serializers.UUIDField(read_only=True, source='project.id')

    class Meta:
        model = Note
        fields = [
            'id',
            'title',
            'content',
            'project_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'project_id', 'created_at', 'updated_at']

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Note title cannot be empty.")
        return value


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


class TODOSerializer(serializers.ModelSerializer):
    """Serializer for Todo objects"""
    project_id = serializers.UUIDField(read_only=True, source='project.id')

    class Meta:
        model = TODO
        fields = [
            'id',
            'title',
            'description',
            'status',
            'priority',
            'project_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'project_id', 'created_at', 'updated_at']

    def validate_title(self, value):
        """Title cannot be empty or whitespace only"""
        if not value or not value.strip():
            raise serializers.ValidationError('Title cannot be empty or whitespace only')
        return value.strip()
