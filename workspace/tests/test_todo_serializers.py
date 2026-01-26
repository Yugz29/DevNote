from django.test import TestCase
from types import SimpleNamespace
from django.db import IntegrityError
from django.contrib.auth import get_user_model
from workspace.models import Project, TODO
from workspace.serializers import TODOSerializer

User = get_user_model()


class TODOSerializerTestCase(TestCase):
    """Test suite for TODOSerializer"""

    def setUp(self):
        """Setup test data"""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.project = Project.objects.create(
            title='Test Project',
            user=self.user
        )

    def get_serializer(self, data=None, instance=None):
        """Helper to get serializer with context"""
        mock_request = SimpleNamespace(user=self.user)
        return TODOSerializer(
            data=data,
            instance=instance,
            context={'request': mock_request}
        )
    
    def test_valid_todo_data(self):
        """Test : serializer with valid data"""
        data = {
            'title': 'Implement API endpoint',
            'description': 'Create /api/todos/ endpoint',
            'status': 'pending',
            'priority': 'high'
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['title'], 'Implement API endpoint')

    def test_minimal_todo_data(self):
        """"Test : serializer with only required field"""
        data = {
            'title': 'Fix bug'
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data.get('status', 'pending'), 'pending')
        self.assertEqual(serializer.validated_data.get('priority', 'medium'), 'medium')

    def test_missing_title(self):
        """Test : title field is required"""
        data = {
            'description': 'No title provided',
            'status': 'pending'
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_empty_title(self):
        """Test : title cannot be empty string"""
        data = {
            'title': '',
            'status': 'pending'
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_whitespace_title(self):
        """Test : title cannot be whitespace only"""
        data = {
            'title': '   ',
            'status': 'pending'
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_title_too_long(self):
        """Test : title respects max length"""
        data = {
            'title': 'x' * 256,
            'status': 'pending'
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_invalid_status(self):
        """Test : status must be one of allowed choices"""
        data = {
            'title': 'Test TODO',
            'status': 'invalid_status'
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('status', serializer.errors)

    def test_invalid_priority(self):
        """Test : priority must be one of the allowed choices"""
        data = {
            'title': 'Test TODO',
            'priority': 'urgent'
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('priority', serializer.errors)
