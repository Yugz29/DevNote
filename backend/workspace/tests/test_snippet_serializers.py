from types import SimpleNamespace
from django.db import IntegrityError
from django.test import TestCase
from django.contrib.auth import get_user_model
from workspace.models import Project, Snippet
from workspace.serializers import SnippetSerializer

User = get_user_model()


class SnippetSerializerTestCase(TestCase):
    """Test suite for SnippetSerializer"""

    def setUp(self):
        """Set up test user and project"""
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
        return SnippetSerializer(
            data=data,
            instance=instance,
            context={'request': mock_request}
        )

    def test_valid_snippet_data(self):
        """Test : serializer with valid data"""
        data = {
            'title': 'Test Snippet',
            'content': 'print("Hello DevNote")',
            'language': 'python',
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        # Project is injected by the view via save(project=...)
        snippet = serializer.save(project=self.project)
        self.assertEqual(snippet.title, data['title'])
        self.assertEqual(snippet.content, data['content'])
        self.assertEqual(snippet.language, data['language'])
        self.assertEqual(snippet.project, self.project)

    def test_missing_title(self):
        """Test : title is required"""
        data = {
            'content': 'print("Hello DevNote")',
            'language': 'python',
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_empty_title(self):
        """Test : title cannot be empty string"""
        data = {
            'title': '',
            'content': 'print("Hello DevNote")',
            'language': 'python',
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_title_spaces_only(self):
        """Test : title with only spaces is invalid"""
        data = {
            'title': '     ',
            'content': 'print("Hello DevNote")',
            'language': 'python',
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_missing_content(self):
        """Test : content is required"""
        data = {
            'title': 'Test Snippet',
            'language': 'python',
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('content', serializer.errors)

    def test_missing_language_defaults_to_text(self):
        """Test : language defaults to 'text' if not provided"""
        data = {
            'title': 'Test Snippet',
            'content': 'print("Hello DevNote")',
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        snippet = serializer.save(project=self.project)
        self.assertEqual(snippet.language, 'text')

    def test_title_too_long(self):
        """Test : title cannot exceed 255 characters"""
        data = {
            'title': 'A' * 256,
            'content': 'print("Hello DevNote")',
            'language': 'python',
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_language_too_long(self):
        """Test : language cannot exceed 50 characters"""
        data = {
            'title': 'Test Snippet',
            'content': 'print("Hello DevNote")',
            'language': 'A' * 51,
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('language', serializer.errors)

    def test_title_trimmed(self):
        """Test : title is automatically trimmed"""
        data = {
            'title': '  My Snippet  ',
            'content': 'print("Hello DevNote")',
            'language': 'python',
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        snippet = serializer.save(project=self.project)
        self.assertEqual(snippet.title, 'My Snippet')

    def test_language_normalized_lowercase(self):
        """Test : language is converted to lowercase"""
        data = {
            'title': 'Python Script',
            'content': 'print("Hello DevNote")',
            'language': 'PYTHON',
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        snippet = serializer.save(project=self.project)
        self.assertEqual(snippet.language, 'python')

    def test_save_without_project_raises_integrity_error(self):
        """Test : saving without injecting a project raises IntegrityError"""
        data = {
            'title': 'Orphan Snippet',
            'content': 'print("Hello DevNote")',
            'language': 'python',
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        with self.assertRaises(IntegrityError):
            serializer.save()

    def test_same_title_different_projects(self):
        """Test : same title is allowed in different projects"""
        project2 = Project.objects.create(
            title='Second Project',
            user=self.user
        )

        Snippet.objects.create(
            title='Shared Title',
            content='print("Project 1")',
            language='python',
            project=self.project
        )

        data = {
            'title': 'Shared Title',
            'content': 'print("Project 2")',
            'language': 'python',
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        snippet = serializer.save(project=project2)
        self.assertEqual(snippet.title, 'Shared Title')
        self.assertEqual(Snippet.objects.count(), 2)
        self.assertEqual(snippet.project, project2)
