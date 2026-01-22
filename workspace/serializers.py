from rest_framework import serializers
from .models import Project

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            'id',
            'name',
            'description',
            'user',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def validate_name(self, value):
        """Validate and clean the project name"""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Project name cannot be empty.")
        return value
    
    def validate(self, data):
        """Check the uniqueness of the name for the user"""
        user = self.context['request'].user
        name = data.get('name')

        # Create the basic query
        if name:
            queryset = Project.objects.filter(user=user, name=name)

            if self.instance: # self.instance exists only in UPDATE
                queryset = queryset.exclude(id=self.instance.id)

            if queryset.exists():
                raise serializers.ValidationError(
                    f"The project '{name}' already exists"
                )
            
        return data
