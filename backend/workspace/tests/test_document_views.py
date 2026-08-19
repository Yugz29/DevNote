from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from workspace.models import Document, Folder, Project

User = get_user_model()


class DocumentViewTest(APITestCase):
    """Tests for Document API views"""

    def setUp(self):
        """Helper to create a test user, project, and authenticate"""
        self.user = User.objects.create_user(
            username="notetestuser", email="document@test.com", password="TestPass123!"
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Document Test Project",
            description="A project for document testing.",
            user=self.user,
        )

        self.document = Document.objects.create(
            title="Test Document",
            content="This is a test document.",
            project=self.project,
        )

    def test_list_documents_authenticated(self):
        """Test listing documents when authenticated"""
        response = self.client.get(f"/api/projects/{self.project.id}/documents/")

        # Status
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Automatic pagination/non-pagination management
        if isinstance(response.data, dict) and "results" in response.data:
            documents = response.data["results"]
            # Test pagination metadata
            self.assertEqual(response.data["count"], 1)
            self.assertIsNone(response.data["next"])
            self.assertIsNone(response.data["previous"])
        else:
            documents = response.data

        # Number of documents
        self.assertEqual(len(documents), 1)

        # Content of the document
        self.assertEqual(documents[0]["title"], self.document.title)
        self.assertEqual(documents[0]["content"], self.document.content)

        # Check UUID is present
        self.assertIn("id", documents[0])

    def test_list_documents_unauthenticated(self):
        """Test listing documents without authentication returns 401"""
        self.client.force_authenticate(user=None)
        response = self.client.get(f"/api/projects/{self.project.id}/documents/")

        # Always 401 (because IsAuthenticate BEFORE get_queryset())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_document(self):
        """Test creating a new document"""
        data = {"title": "New Document", "content": "A new test Document"}
        response = self.client.post(
            f"/api/projects/{self.project.id}/documents/", data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New Document")
        self.assertEqual(response.data["content"], "A new test Document")
        self.assertEqual(response.data["project_id"], str(self.project.id))

        self.assertTrue(
            Document.objects.filter(title="New Document", project=self.project).exists()
        )

    def test_create_document_unauthenticated(self):
        """Test creating document when unauthenticated"""
        self.client.force_authenticate(user=None)
        data = {
            "title": "Unauthorized Document",
            "content": "Unauthorized Document content",
        }
        response = self.client.post(
            f"/api/projects/{self.project.id}/documents/", data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Document.objects.count(), 1)

    def test_retrieve_document(self):
        """Test retrieving a specific document"""
        response = self.client.get(
            f"/api/projects/{self.project.id}/documents/{self.document.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], self.document.title)
        self.assertEqual(response.data["content"], self.document.content)

    def test_update_document(self):
        """Test updating a document"""
        data = {
            "title": "Updated title Document",
            "content": "Updated content Document",
        }
        response = self.client.patch(
            f"/api/projects/{self.project.id}/documents/{self.document.id}/",
            data,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Updated title Document")
        self.assertEqual(response.data["content"], "Updated content Document")

        self.document.refresh_from_db()
        self.assertEqual(self.document.title, "Updated title Document")
        self.assertEqual(self.document.content, "Updated content Document")

    def test_delete_document(self):
        """Test deleting a document"""
        response = self.client.delete(
            f"/api/projects/{self.project.id}/documents/{self.document.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Document.objects.count(), 0)

    def test_user_isolation(self):
        """Test that users cannot acces each other's documents"""
        other_user = User.objects.create_user(
            username="otheruser", email="other@test.com", password="OtherPass123!"
        )
        other_project = Project.objects.create(
            title="Other Project",
            description="A project for the other user",
            user=other_user,
        )
        other_document = Document.objects.create(
            title="Other Document",
            content="A Document for the other project",
            project=other_project,
        )

        response = self.client.get(
            f"/api/projects/{other_project.id}/documents/{other_document.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = self.client.get(f"/api/projects/{self.project.id}/documents/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and "results" in response.data:
            documents = response.data["results"]
        else:
            documents = response.data

        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["title"], self.document.title)

        data = {"title": "Hack attempt", "content": "Trying to create in other project"}
        response = self.client.post(
            f"/api/projects/{other_project.id}/documents/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_project_isolation(self):
        """Test that documents are strictly isolated by project"""

        project_b = Project.objects.create(
            title="Project B",
            description="Another project for same user",
            user=self.user,
        )

        Document.objects.create(
            title="Document in Project B",
            content="This belongs to Project B",
            project=project_b,
        )

        response = self.client.get(f"/api/projects/{self.project.id}/documents/")
        if isinstance(response.data, dict) and "results" in response.data:
            documents = response.data["results"]
        else:
            documents = response.data

        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["title"], "Test Document")

        response = self.client.get(f"/api/projects/{project_b.id}/documents/")
        if isinstance(response.data, dict) and "results" in response.data:
            documents = response.data["results"]
        else:
            documents = response.data

        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["title"], "Document in Project B")

    def test_duplicate_document(self):
        """Test duplicating a document copies its content into the same project"""
        response = self.client.post(
            f"/api/documents/{self.document.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test Document (copy)")
        self.assertEqual(response.data["content"], self.document.content)
        self.assertEqual(response.data["project_id"], str(self.project.id))
        self.assertIsNone(response.data["folder"])
        self.assertNotEqual(response.data["id"], str(self.document.id))

        self.assertEqual(Document.objects.count(), 2)

        self.document.refresh_from_db()
        self.assertEqual(self.document.title, "Test Document")

    def test_duplicate_document_nested_route(self):
        """Test duplicating a document through the project nested route"""
        response = self.client.post(
            f"/api/projects/{self.project.id}/documents/{self.document.id}/duplicate/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test Document (copy)")
        self.assertEqual(Document.objects.count(), 2)

    def test_duplicate_document_keeps_folder(self):
        """Test the copy lands in the folder holding the original document"""
        folder = Folder.objects.create(name="Guides", project=self.project)
        document = Document.objects.create(
            title="Filed Document",
            content="Filed content",
            project=self.project,
            folder=folder,
        )

        response = self.client.post(
            f"/api/documents/{document.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["folder"], folder.id)

        copy = Document.objects.get(id=response.data["id"])
        self.assertEqual(copy.folder, folder)
        self.assertEqual(copy.content, document.content)

    def test_duplicate_document_numbers_further_copies(self):
        """Test duplicating twice in a row does not repeat the same title"""
        first = self.client.post(
            f"/api/documents/{self.document.id}/duplicate/", format="json"
        )
        second = self.client.post(
            f"/api/documents/{self.document.id}/duplicate/", format="json"
        )

        self.assertEqual(first.data["title"], "Test Document (copy)")
        self.assertEqual(second.data["title"], "Test Document (copy 2)")
        self.assertEqual(Document.objects.count(), 3)

    def test_duplicate_document_truncates_long_title(self):
        """Test the copy title stays within the title max length"""
        max_length = Document._meta.get_field("title").max_length
        document = Document.objects.create(
            title="N" * max_length, content="Long title content", project=self.project
        )

        response = self.client.post(
            f"/api/documents/{document.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["title"]), max_length)
        self.assertTrue(response.data["title"].endswith(" (copy)"))

    def test_duplicate_document_unauthenticated(self):
        """Test duplicating a document without authentication returns 401"""
        self.client.force_authenticate(user=None)
        response = self.client.post(
            f"/api/documents/{self.document.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Document.objects.count(), 1)

    def test_duplicate_document_user_isolation(self):
        """Test that users cannot duplicate each other's documents"""
        other_user = User.objects.create_user(
            username="duplicateotheruser",
            email="duplicate-other@test.com",
            password="OtherPass123!",
        )
        other_project = Project.objects.create(
            title="Other Duplicate Project",
            description="A project for the other user",
            user=other_user,
        )
        other_document = Document.objects.create(
            title="Other Document",
            content="A Document for the other project",
            project=other_project,
        )

        response = self.client.post(
            f"/api/documents/{other_document.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Document.objects.filter(project=other_project).count(), 1)

    def test_document_is_unpinned_on_create(self):
        """Test that a document created through the API starts unpinned"""
        response = self.client.post(
            f"/api/projects/{self.project.id}/documents/",
            {"title": "Fresh Document", "content": "Fresh content"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["is_pinned"])

    def test_pin_document_through_patch(self):
        """Test that the generic document update toggles the pin"""
        response = self.client.patch(
            f"/api/documents/{self.document.id}/", {"is_pinned": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_pinned"])

        self.document.refresh_from_db()
        self.assertTrue(self.document.is_pinned)

        response = self.client.patch(
            f"/api/documents/{self.document.id}/", {"is_pinned": False}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_pinned"])

        self.document.refresh_from_db()
        self.assertFalse(self.document.is_pinned)

    def test_pinning_leaves_the_document_in_place(self):
        """Test that pinning changes nothing but the flag"""
        folder = Folder.objects.create(name="Filed", project=self.project)
        document = Document.objects.create(
            title="Filed Document",
            content="Filed content",
            project=self.project,
            folder=folder,
        )

        response = self.client.patch(
            f"/api/documents/{document.id}/", {"is_pinned": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        document.refresh_from_db()
        self.assertTrue(document.is_pinned)
        self.assertEqual(document.folder, folder)
        self.assertEqual(document.title, "Filed Document")
        self.assertEqual(document.content, "Filed content")

    def test_retrieve_document_exposes_is_pinned(self):
        """Test that the pin state is readable on a single document"""
        self.document.is_pinned = True
        self.document.save()

        response = self.client.get(
            f"/api/projects/{self.project.id}/documents/{self.document.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_pinned"])

    def test_pinning_a_foreign_document_denied(self):
        """Test that users cannot pin each other's documents"""
        other_user = User.objects.create_user(
            username="pinotheruser",
            email="pin-other@test.com",
            password="OtherPass123!",
        )
        other_project = Project.objects.create(
            title="Other Pin Project",
            description="A project for the other user",
            user=other_user,
        )
        other_document = Document.objects.create(
            title="Other Document",
            content="A Document for the other project",
            project=other_project,
        )

        response = self.client.patch(
            f"/api/documents/{other_document.id}/", {"is_pinned": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        other_document.refresh_from_db()
        self.assertFalse(other_document.is_pinned)

    def test_duplicate_document_leaves_the_copy_unpinned(self):
        """Test that duplicating a pinned document does not pin the copy"""
        self.document.is_pinned = True
        self.document.save()

        response = self.client.post(
            f"/api/documents/{self.document.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["is_pinned"])

        self.document.refresh_from_db()
        self.assertTrue(self.document.is_pinned)


class ProjectPinnedViewTest(APITestCase):
    """Tests for the project-wide pinned documents endpoint"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="pinnedviewuser",
            email="pinnedview@test.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Pinned View Project", user=self.user
        )
        self.folder = Folder.objects.create(name="Archives", project=self.project)
        self.nested = Folder.objects.create(
            name="Deep", project=self.project, parent=self.folder
        )

    def test_pinned_gathers_documents_across_the_folder_tree(self):
        """Test that the endpoint reaches pinned documents at any depth"""
        root_pinned = Document.objects.create(
            title="Root pinned", project=self.project, is_pinned=True
        )
        deep_pinned = Document.objects.create(
            title="Deep pinned",
            project=self.project,
            folder=self.nested,
            is_pinned=True,
        )
        Document.objects.create(title="Root plain", project=self.project)
        Document.objects.create(
            title="Filed plain", project=self.project, folder=self.folder
        )

        response = self.client.get(f"/api/projects/{self.project.id}/pinned/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

        ids = {entry["id"] for entry in response.data["results"]}
        self.assertEqual(ids, {str(root_pinned.id), str(deep_pinned.id)})

    def test_pinned_entries_use_the_gallery_card_shape(self):
        """Test that pinned entries render like any other gallery document"""
        document = Document.objects.create(
            title="Pinned document",
            content="# Heading\n\nSome body text.",
            project=self.project,
            folder=self.folder,
            is_pinned=True,
        )

        response = self.client.get(f"/api/projects/{self.project.id}/pinned/")
        entry = response.data["results"][0]

        self.assertEqual(
            set(entry.keys()),
            {
                "type",
                "id",
                "title",
                "preview",
                "project_id",
                "folder",
                "is_pinned",
                "created_at",
                "updated_at",
            },
        )
        self.assertEqual(entry["type"], "document")
        self.assertTrue(entry["is_pinned"])
        self.assertEqual(entry["folder"], self.folder.id)
        self.assertEqual(entry["preview"], "Heading Some body text.")
        self.assertEqual(entry["title"], document.title)

    def test_pinned_is_empty_when_nothing_is_pinned(self):
        """Test that a project without pinned documents returns an empty stream"""
        Document.objects.create(title="Root plain", project=self.project)

        response = self.client.get(f"/api/projects/{self.project.id}/pinned/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(response.data["results"], [])

    def test_pinned_is_scoped_to_the_project(self):
        """Test that pinned documents of another project are not listed"""
        other_project = Project.objects.create(
            title="Other Pinned Project", user=self.user
        )
        Document.objects.create(
            title="Elsewhere", project=other_project, is_pinned=True
        )
        mine = Document.objects.create(
            title="Mine", project=self.project, is_pinned=True
        )

        response = self.client.get(f"/api/projects/{self.project.id}/pinned/")

        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(mine.id))

    def test_pinned_of_foreign_project_denied(self):
        """Test that users cannot read another user's pinned documents"""
        other_user = User.objects.create_user(
            username="pinnedforeign",
            email="pinnedforeign@test.com",
            password="OtherPass123!",
        )
        foreign_project = Project.objects.create(
            title="Foreign Project", user=other_user
        )
        Document.objects.create(
            title="Foreign pinned", project=foreign_project, is_pinned=True
        )

        response = self.client.get(f"/api/projects/{foreign_project.id}/pinned/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_pinned_unauthenticated(self):
        """Test that the pinned endpoint requires authentication"""
        self.client.force_authenticate(user=None)
        response = self.client.get(f"/api/projects/{self.project.id}/pinned/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_pinned_is_paginated(self):
        """Test that the pinned stream follows the pagination shape"""
        for index in range(25):
            Document.objects.create(
                title=f"Pinned {index}", project=self.project, is_pinned=True
            )

        response = self.client.get(f"/api/projects/{self.project.id}/pinned/")

        self.assertEqual(
            set(response.data.keys()), {"count", "next", "previous", "results"}
        )
        self.assertEqual(response.data["count"], 25)
        self.assertEqual(len(response.data["results"]), 20)
        self.assertIsNotNone(response.data["next"])
