from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase

from workspace.models import Document, Project
from workspace.serializers import DocumentSerializer

User = get_user_model()


class DocumentSerializerTest(TestCase):
    def setUp(self):
        """Set up a user and a project for testing"""
        self.user = User.objects.create_user(
            username="usertest", email="user@test.com", password="TestPass123!"
        )
        self.project = Project.objects.create(title="Test Project", user=self.user)

    def get_serializer(self, data=None, instance=None):
        """Helper to get serializer with context"""
        mock_request = SimpleNamespace(user=self.user)
        return DocumentSerializer(
            data=data, instance=instance, context={"request": mock_request}
        )

    def test_valid_document_data(self):
        """Test serializer with valid data"""
        data = {
            "title": "Test Document",
            "content": "This is a test document.",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        # Project is injected by the view via save(project=...)
        document = serializer.save(project=self.project)
        self.assertEqual(document.title, data["title"])
        self.assertEqual(document.content, data["content"])
        self.assertEqual(document.project, self.project)

    def test_missing_title(self):
        """Test that title is required"""
        data = {"content": "This is a test document."}
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_title_too_long(self):
        """Test that title exceeding max length is invalid"""
        data = {
            "title": "A" * 256,
            "content": "This is a test document.",
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_empty_content_allowed(self):
        """Test that empty content is valid"""
        data = {
            "title": "Test Document",
            "content": "",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        document = serializer.save(project=self.project)
        self.assertEqual(document.content, "")

    def test_title_trimmed(self):
        """Test that title is trimmed of whitespace"""
        data = {
            "title": "   Trimmed Document Title   ",
            "content": "Content here.",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        document = serializer.save(project=self.project)
        self.assertEqual(document.title, "Trimmed Document Title")

    def test_title_spaces_only(self):
        """Test that title with only spaces is invalid"""
        data = {
            "title": "     ",
            "content": "Content here.",
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_read_only_fields(self):
        """Test that read-only fields cannot be set"""
        fake_date = "2024-01-01T00:00:00Z"
        data = {
            "title": "Test Document",
            "content": "This is a test document.",
            "id": 666,
            "created_at": fake_date,
            "updated_at": fake_date,
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        document = serializer.save(project=self.project)
        self.assertNotEqual(document.id, 666)
        self.assertNotEqual(str(document.created_at), fake_date)
        self.assertNotEqual(str(document.updated_at), fake_date)

    def test_is_pinned_defaults_to_false(self):
        """Test that a document serialized without is_pinned comes out unpinned"""
        data = {
            "title": "Test Document",
            "content": "This is a test document.",
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        document = serializer.save(project=self.project)

        self.assertFalse(document.is_pinned)
        self.assertFalse(serializer.data["is_pinned"])

    def test_is_pinned_is_writable(self):
        """Test that is_pinned can be set through the serializer"""
        document = Document.objects.create(title="Test Document", project=self.project)
        serializer = self.get_serializer(
            data={"title": document.title, "is_pinned": True}, instance=document
        )

        self.assertTrue(serializer.is_valid(raise_exception=False))
        updated = serializer.save()

        self.assertTrue(updated.is_pinned)
