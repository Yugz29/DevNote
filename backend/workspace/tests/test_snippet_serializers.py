from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase

from workspace.models import Folder, Project, Snippet
from workspace.serializers import SnippetSerializer

User = get_user_model()


class SnippetSerializerTestCase(TestCase):
    """Test suite for SnippetSerializer"""

    def setUp(self):
        """Set up test user and project"""
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.project = Project.objects.create(title="Test Project", user=self.user)

    def get_serializer(self, data=None, instance=None):
        """Helper to get serializer with context"""
        mock_request = SimpleNamespace(user=self.user)
        return SnippetSerializer(
            data=data, instance=instance, context={"request": mock_request}
        )

    def test_valid_snippet_data(self):
        """Test : serializer with valid data"""
        data = {
            "title": "Test Snippet",
            "content": 'print("Hello DevNote")',
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        # Project is injected by the view via save(project=...)
        snippet = serializer.save(project=self.project)
        self.assertEqual(snippet.title, data["title"])
        self.assertEqual(snippet.content, data["content"])
        self.assertEqual(snippet.language, data["language"])
        self.assertEqual(snippet.project, self.project)

    def test_missing_title(self):
        """Test : title is required"""
        data = {
            "content": 'print("Hello DevNote")',
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_empty_title(self):
        """Test : title cannot be empty string"""
        data = {
            "title": "",
            "content": 'print("Hello DevNote")',
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_title_spaces_only(self):
        """Test : title with only spaces is invalid"""
        data = {
            "title": "     ",
            "content": 'print("Hello DevNote")',
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_missing_content(self):
        """Test : content is required"""
        data = {
            "title": "Test Snippet",
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("content", serializer.errors)

    def test_missing_language_defaults_to_text(self):
        """Test : language defaults to 'text' if not provided"""
        data = {
            "title": "Test Snippet",
            "content": 'print("Hello DevNote")',
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        snippet = serializer.save(project=self.project)
        self.assertEqual(snippet.language, "text")

    def test_title_too_long(self):
        """Test : title cannot exceed 255 characters"""
        data = {
            "title": "A" * 256,
            "content": 'print("Hello DevNote")',
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_language_too_long(self):
        """Test : language cannot exceed 50 characters"""
        data = {
            "title": "Test Snippet",
            "content": 'print("Hello DevNote")',
            "language": "A" * 51,
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("language", serializer.errors)

    def test_title_trimmed(self):
        """Test : title is automatically trimmed"""
        data = {
            "title": "  My Snippet  ",
            "content": 'print("Hello DevNote")',
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        snippet = serializer.save(project=self.project)
        self.assertEqual(snippet.title, "My Snippet")

    def test_language_normalized_lowercase(self):
        """Test : language is converted to lowercase"""
        data = {
            "title": "Python Script",
            "content": 'print("Hello DevNote")',
            "language": "PYTHON",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        snippet = serializer.save(project=self.project)
        self.assertEqual(snippet.language, "python")

    def test_save_without_project_raises_integrity_error(self):
        """Test : saving without injecting a project raises IntegrityError"""
        data = {
            "title": "Orphan Snippet",
            "content": 'print("Hello DevNote")',
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        with self.assertRaises(IntegrityError):
            serializer.save()

    def test_same_title_different_projects(self):
        """Test : same title is allowed in different projects"""
        project2 = Project.objects.create(title="Second Project", user=self.user)

        Snippet.objects.create(
            title="Shared Title",
            content='print("Project 1")',
            language="python",
            project=self.project,
        )

        data = {
            "title": "Shared Title",
            "content": 'print("Project 2")',
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        snippet = serializer.save(project=project2)
        self.assertEqual(snippet.title, "Shared Title")
        self.assertEqual(Snippet.objects.count(), 2)
        self.assertEqual(snippet.project, project2)

    def test_is_pinned_defaults_to_false(self):
        """Test : a snippet serialized without is_pinned comes out unpinned"""
        data = {
            "title": "Test Snippet",
            "content": 'print("Hello DevNote")',
            "language": "python",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        snippet = serializer.save(project=self.project)

        self.assertFalse(snippet.is_pinned)
        self.assertFalse(serializer.data["is_pinned"])

    def test_is_pinned_is_writable(self):
        """Test : is_pinned can be set through the serializer"""
        snippet = Snippet.objects.create(
            title="Test Snippet",
            content='print("Hello DevNote")',
            language="python",
            project=self.project,
        )
        serializer = self.get_serializer(
            data={
                "title": snippet.title,
                "content": snippet.content,
                "is_pinned": True,
            },
            instance=snippet,
        )

        self.assertTrue(serializer.is_valid(raise_exception=False))
        updated = serializer.save()

        self.assertTrue(updated.is_pinned)


class SnippetFolderFieldTest(TestCase):
    """Tests for the folder field added to Snippet"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="snippetfolderuser",
            email="snippetfolder@test.com",
            password="TestPass123!",
        )
        self.project = Project.objects.create(
            title="Snippet Folder Project", user=self.user
        )
        self.snippet_folder = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )
        self.document_folder = Folder.objects.create(
            name="Archives", project=self.project
        )

    def get_serializer(self, data=None, instance=None, project=None, partial=False):
        mock_request = SimpleNamespace(user=self.user)
        context = {"request": mock_request}

        if project is not None:
            context["project"] = project

        return SnippetSerializer(
            data=data, instance=instance, context=context, partial=partial
        )

    def payload(self, **overrides):
        return {
            "title": "Helper",
            "content": "pass",
            "language": "python",
            **overrides,
        }

    def test_folder_exposed(self):
        """Test that the serialized payload carries the folder"""
        snippet = Snippet.objects.create(
            title="Helper",
            content="pass",
            project=self.project,
            folder=self.snippet_folder,
        )

        data = SnippetSerializer(
            snippet, context={"request": SimpleNamespace(user=self.user)}
        ).data

        self.assertEqual(data["folder"], self.snippet_folder.id)

    def test_create_in_a_snippet_folder(self):
        """Test that a snippet can be created inside a snippet folder"""
        serializer = self.get_serializer(
            data=self.payload(folder=str(self.snippet_folder.id)),
            project=self.project,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        snippet = serializer.save(project=self.project)

        self.assertEqual(snippet.folder, self.snippet_folder)

    def test_create_without_folder_stays_at_root(self):
        """Test that the folder is optional"""
        serializer = self.get_serializer(data=self.payload(), project=self.project)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        snippet = serializer.save(project=self.project)

        self.assertIsNone(snippet.folder)

    def test_document_folder_rejected(self):
        """Test that a snippet cannot land in a folder holding documents"""
        serializer = self.get_serializer(
            data=self.payload(folder=str(self.document_folder.id)),
            project=self.project,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("folder", serializer.errors)

    def test_folder_of_another_project_rejected(self):
        """Test that the folder must belong to the project of the snippet"""
        other_project = Project.objects.create(
            title="Other Snippet Folder Project", user=self.user
        )
        other_folder = Folder.objects.create(
            name="Elsewhere", project=other_project, resource_type="snippets"
        )

        serializer = self.get_serializer(
            data=self.payload(folder=str(other_folder.id)), project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("folder", serializer.errors)

    def test_folder_of_another_user_is_unknown(self):
        """Test that the folder field only sees the folders of the caller"""
        stranger = User.objects.create_user(
            username="snippetfolderstranger",
            email="snippetfolderstranger@test.com",
            password="TestPass123!",
        )
        stranger_project = Project.objects.create(title="Stranger", user=stranger)
        stranger_folder = Folder.objects.create(
            name="Private", project=stranger_project, resource_type="snippets"
        )

        serializer = self.get_serializer(
            data=self.payload(folder=str(stranger_folder.id)), project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("folder", serializer.errors)
