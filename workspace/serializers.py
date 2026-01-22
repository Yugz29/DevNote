from rest_framework import serializers
from .models import Project

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

    def validate_name(self, value):
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
