from rest_framework import serializers
from .models import Project

class ProjectSerializer(serializers.ModelSerializer):
    name = serializers.CharField(min_length=1, max_length=255)

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
