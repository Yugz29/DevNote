from uuid import UUID

from django.contrib.auth import get_user_model
from django.test import TestCase

from workspace.models import Document, Project
from workspace.serializers import DocumentSerializer

User = get_user_model()


class DocumentModelTest(TestCase):
    """Tests for the Document model"""

    def setUp(self):
        """Preparation: create a test user and a project"""
        self.user = User.objects.create_user(
            username="notetestuser", email="user@test.com", password="TestPass123!"
        )
        self.project = Project.objects.create(
            title="Document Test Project",
            description="A project for document testing.",
            user=self.user,
        )

    def test_create_document(self):
        """Test creating a document"""
        document = Document.objects.create(
            title="Test Document", content="", project=self.project
        )

        self.assertEqual(document.title, "Test Document")
        self.assertEqual(document.project, self.project)
        self.assertIsNotNone(document.created_at)
        self.assertIsInstance(document.id, UUID)
        self.assertEqual(document.content, "")

    def test_delete_document_cascade(self):
        """Test that deleting a project cascades to delete its documents"""
        Document.objects.create(
            title="Document to be deleted",
            content="This document will be deleted when the project is deleted.",
            project=self.project,
        )

        self.assertEqual(Document.objects.count(), 1)
        self.project.delete()
        self.assertEqual(Document.objects.count(), 0)

    def test_same_document_title(self):
        """Test that documents with the same title can exist under the same project"""
        document1 = Document.objects.create(
            title="First Document", project=self.project
        )
        document2 = Document.objects.create(
            title="First Document", project=self.project
        )

        documents = self.project.documents.all()
        self.assertEqual(documents.count(), 2)
        self.assertIn(document1, documents)
        self.assertIn(document2, documents)
        self.assertNotEqual(document1.id, document2.id)

    def test_empty_document_title(self):
        """Test that a document with a whitespace-only title is rejected by the
        serializer"""
        from types import SimpleNamespace

        mock_request = SimpleNamespace(user=self.user)
        serializer = DocumentSerializer(
            data={"title": "   ", "content": ""}, context={"request": mock_request}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_str_method(self):
        """Test the __str__ method of the Document model"""
        document = Document.objects.create(
            title="String Method Document", project=self.project
        )
        self.assertEqual(str(document), "String Method Document")

    def test_document_is_not_pinned_by_default(self):
        """Test that a new document starts unpinned"""
        document = Document.objects.create(title="Fresh Document", project=self.project)

        self.assertFalse(document.is_pinned)

    def test_pin_document(self):
        """Test that a document can be pinned and unpinned"""
        document = Document.objects.create(
            title="Pinnable Document", project=self.project
        )

        document.is_pinned = True
        document.save()
        document.refresh_from_db()
        self.assertTrue(document.is_pinned)

        document.is_pinned = False
        document.save()
        document.refresh_from_db()
        self.assertFalse(document.is_pinned)
