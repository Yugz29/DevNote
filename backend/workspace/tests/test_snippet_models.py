from django.test import TestCase
from django.contrib.auth import get_user_model
from workspace.models import Project, Snippet
from uuid import UUID
from django.core.exceptions import ValidationError
from workspace.serializers import SnippetSerializer

User = get_user_model()


class SnippetModelTest(TestCase):
    """Test for the Snippet model"""

    def setUp(self):
        """Preparation : create a test user and a project"""
        self.user = User.objects.create_user(
            username='notetestuser',
            email='user@test.com',
            password='TestPass123!'
        )
        self.project = Project.objects.create(
            title='Note Test Project',
            description='A project for note testing.',
            user=self.user
        )
    
    def test_create_snippet(self):
        """Test : create a snippet"""
        snippet = Snippet.objects.create(
            title='Test Snippet',
            content='print("Hello DevNote")',
            language='python',
            project=self.project
        )

        self.assertEqual(snippet.title, 'Test Snippet')
        self.assertEqual(snippet.content, 'print("Hello DevNote")')
        self.assertEqual(snippet.language, 'python')
        self.assertEqual(snippet.project, self.project)
        self.assertIsNotNone(snippet.created_at)
        self.assertIsInstance(snippet.id, UUID)

    def test_snippet_str_representation(self):
        """Test : __str__ method returns 'title (language)'"""
        snippet = Snippet.objects.create(
            title='My JS Function',
            content='console.log("test");',
            language='javascript',
            project=self.project
        )

        self.assertEqual(str(snippet), 'My JS Function (javascript)')

    def test_snippet_default_language(self):
        """Test : Verify is language = 'text' when no specify"""
        snippet = Snippet.objects.create(
            title='No Language Specified',
            content='Just some text',
            project=self.project
        )

        self.assertEqual(snippet.language, 'text')

    def test_snippet_relationships(self):
        """Test : Snippet is linked to project and vice versa"""
        snippet = Snippet.objects.create(
            title='Relationship Test',
            content='def test(): pass',
            language='python',
            project=self.project
        )

        self.assertEqual(snippet.project, self.project)
        self.assertIn(snippet, self.project.snippets.all())
        self.assertEqual(self.project.snippets.count(), 1)

    def test_snippet_cascade_delete(self):
        """Test : Deletin project deletes all its snippets"""
        snippet = Snippet.objects.create(
            title='Will be deleted',
            content='code',
            language='python',
            project=self.project
        )

        self.assertEqual(Snippet.objects.count(), 1)
        self.project.delete()
        self.assertEqual(Snippet.objects.count(), 0)

    def test_snippet_content_required(self):
        """Test : Content field is required"""
        snippet = Snippet(
            title='No content',
            language='python',
            project=self.project
        )
        with self.assertRaises(ValidationError):
            snippet.full_clean()

    def test_snippet_title_max_length(self):
        """Test : Title cannot exceed 255 characters"""
        long_title = 'a' * 256

        snippet = Snippet(
            title=long_title,
            content='code',
            language='python',
            project=self.project
        )
        with self.assertRaises(ValidationError):
            snippet.full_clean()
