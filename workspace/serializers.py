from rest_framework import serializers
from .models import Project, Note

class ProjectSerializer(serializers.ModelSerializer):
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
