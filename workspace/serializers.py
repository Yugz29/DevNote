from rest_framework import serializers
from .models import Project, Note, Snippet

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
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        write_only=True,
        required=False # Optionnal (as provided by nested route or body)
    )

    class Meta:
        model = Note
        fields = [
            'id',
            'title',
            'content',
            'project',
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
        
    def validate_project(self, value):
        """Ensure the note's project belongs to the user"""
        user = self.context['request'].user
        if value.user != user:
            raise serializers.ValidationError(
                "You do not have permission for this project."
            )
        return value


class SnippetSerializer(serializers.ModelSerializer):
    """Serializer for Snippet model"""
    project_id = serializers.UUIDField(read_only=True, source='project.id')
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        write_only=True,
        required=True
    )

    class Meta:
        model = Snippet
        fields = [
            'id',
            'title',
            'content',
            'language',
            'description',
            'project',
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
    
    def validate(self, data):
        """
        Validate snippet uniqueness within project
        - Title must be unique per project (case-insensitive)
        """
        title = data.get('title')
        project = data.get('project')
        
        if title and project:
            queryset = Snippet.objects.filter(
                project=project,
                title__iexact=title
            )
            
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            
            if queryset.exists():
                raise serializers.ValidationError({
                    'title': 'A snippet with this title already exists in this project.'
                })
        
        return data
