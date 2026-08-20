from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from workspace.models import TODO, Document, Folder, Project, Snippet, TodoList

User = get_user_model()


class MoveTestCase(APITestCase):
    """Shared fixtures: one user, two projects, a stranger with a third"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="moveuser", email="move@test.com", password="TestPass123!"
        )
        self.client.force_authenticate(user=self.user)

        self.origin = Project.objects.create(title="Origin", user=self.user)
        self.destination = Project.objects.create(title="Destination", user=self.user)

        self.stranger = User.objects.create_user(
            username="movestranger",
            email="movestranger@test.com",
            password="TestPass123!",
        )
        self.foreign = Project.objects.create(title="Foreign", user=self.stranger)

    def make_folder(self, name, project=None, parent=None, resource_type="documents"):
        return Folder.objects.create(
            name=name,
            project=project or self.origin,
            parent=parent,
            resource_type=resource_type,
        )

    def make_document(self, title, project=None, folder=None, is_pinned=False):
        return Document.objects.create(
            title=title,
            content="",
            project=project or self.origin,
            folder=folder,
            is_pinned=is_pinned,
        )

    def make_snippet(self, title, project=None, folder=None, is_pinned=False):
        return Snippet.objects.create(
            title=title,
            content="pass",
            language="python",
            project=project or self.origin,
            folder=folder,
            is_pinned=is_pinned,
        )


class DocumentMoveTest(MoveTestCase):
    """Tests for POST /api/documents/{id}/move/"""

    def test_move_to_another_folder_of_the_same_project(self):
        """Test : without a project, the move stays where the document lives"""
        folder = self.make_folder("Archives")
        document = self.make_document("Notes")

        response = self.client.post(
            f"/api/documents/{document.id}/move/",
            {"folder": str(folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        document.refresh_from_db()
        self.assertEqual(document.folder, folder)
        self.assertEqual(document.project, self.origin)

    def test_move_to_the_root_of_another_project(self):
        """Test : a document reaches another project without a folder"""
        document = self.make_document("Notes", folder=self.make_folder("Archives"))

        response = self.client.post(
            f"/api/documents/{document.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        document.refresh_from_db()
        self.assertEqual(document.project, self.destination)
        self.assertIsNone(document.folder)

    def test_move_into_a_folder_of_another_project(self):
        """Test : a document reaches a folder of the destination project"""
        folder = self.make_folder("Archives", project=self.destination)
        document = self.make_document("Notes")

        response = self.client.post(
            f"/api/documents/{document.id}/move/",
            {"project": str(self.destination.id), "folder": str(folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        document.refresh_from_db()
        self.assertEqual(document.project, self.destination)
        self.assertEqual(document.folder, folder)

    def test_folder_of_the_origin_project_rejected(self):
        """Test : the folder must belong to the project being moved into"""
        folder = self.make_folder("Archives")
        document = self.make_document("Notes")

        response = self.client.post(
            f"/api/documents/{document.id}/move/",
            {"project": str(self.destination.id), "folder": str(folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("folder", response.data)
        document.refresh_from_db()
        self.assertEqual(document.project, self.origin)

    def test_snippet_folder_rejected(self):
        """Test : a document cannot land in a folder holding snippets"""
        folder = self.make_folder("Helpers", resource_type="snippets")
        document = self.make_document("Notes")

        response = self.client.post(
            f"/api/documents/{document.id}/move/",
            {"folder": str(folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("folder", response.data)

    def test_move_to_a_foreign_project_denied(self):
        """Test : the destination project must belong to the caller"""
        document = self.make_document("Notes")

        response = self.client.post(
            f"/api/documents/{document.id}/move/",
            {"project": str(self.foreign.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        document.refresh_from_db()
        self.assertEqual(document.project, self.origin)

    def test_move_of_a_foreign_document_denied(self):
        """Test : a document of another user cannot be moved"""
        document = self.make_document("Notes", project=self.foreign)

        response = self.client.post(
            f"/api/documents/{document.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_project_id_rejected(self):
        """Test : a malformed project id is a bad request"""
        document = self.make_document("Notes")

        response = self.client.post(
            f"/api/documents/{document.id}/move/",
            {"project": "not-a-uuid"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("project", response.data)

    def test_pin_survives_the_move(self):
        """Test : changing project keeps an explicit pin"""
        document = self.make_document("Notes", is_pinned=True)

        response = self.client.post(
            f"/api/documents/{document.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        self.assertTrue(response.data["is_pinned"])
        document.refresh_from_db()
        self.assertTrue(document.is_pinned)

    def test_moved_document_leaves_the_listing_of_its_old_project(self):
        """Test : the move is a departure, not a copy"""
        document = self.make_document("Notes")

        self.client.post(
            f"/api/documents/{document.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        response = self.client.get(f"/api/projects/{self.origin.id}/documents/")

        self.assertEqual(response.data["count"], 0)


class SnippetMoveTest(MoveTestCase):
    """Tests for POST /api/snippets/{id}/move/"""

    def test_move_to_the_root_of_another_project(self):
        """Test : a snippet reaches another project without a folder"""
        snippet = self.make_snippet(
            "Helper", folder=self.make_folder("Helpers", resource_type="snippets")
        )

        response = self.client.post(
            f"/api/snippets/{snippet.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        snippet.refresh_from_db()
        self.assertEqual(snippet.project, self.destination)
        self.assertIsNone(snippet.folder)

    def test_move_into_a_folder_of_another_project(self):
        """Test : a snippet reaches a folder of the destination project"""
        folder = self.make_folder(
            "Helpers", project=self.destination, resource_type="snippets"
        )
        snippet = self.make_snippet("Helper")

        response = self.client.post(
            f"/api/snippets/{snippet.id}/move/",
            {"project": str(self.destination.id), "folder": str(folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        snippet.refresh_from_db()
        self.assertEqual(snippet.folder, folder)

    def test_document_folder_rejected(self):
        """Test : a snippet cannot land in a folder holding documents"""
        folder = self.make_folder("Archives")
        snippet = self.make_snippet("Helper")

        response = self.client.post(
            f"/api/snippets/{snippet.id}/move/",
            {"folder": str(folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("folder", response.data)

    def test_move_to_a_foreign_project_denied(self):
        """Test : the destination project must belong to the caller"""
        snippet = self.make_snippet("Helper")

        response = self.client.post(
            f"/api/snippets/{snippet.id}/move/",
            {"project": str(self.foreign.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_pin_survives_the_move(self):
        """Test : changing project keeps an explicit pin"""
        snippet = self.make_snippet("Helper", is_pinned=True)

        self.client.post(
            f"/api/snippets/{snippet.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        snippet.refresh_from_db()
        self.assertTrue(snippet.is_pinned)


class TodoMoveTest(MoveTestCase):
    """Tests for POST /api/todos/{id}/move/"""

    def setUp(self):
        super().setUp()

        self.origin_list = TodoList.objects.create(name="Sprint", project=self.origin)
        self.destination_list = TodoList.objects.create(
            name="Backlog", project=self.destination
        )

    def make_todo(self, title, project=None, todo_list=None, is_pinned=False):
        return TODO.objects.create(
            title=title,
            project=project or self.origin,
            list=todo_list,
            is_pinned=is_pinned,
        )

    def test_move_to_another_list_of_the_same_project(self):
        """Test : without a project, the move is a change of list"""
        todo = self.make_todo("Ship it")

        response = self.client.post(
            f"/api/todos/{todo.id}/move/",
            {"list": str(self.origin_list.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        todo.refresh_from_db()
        self.assertEqual(todo.list, self.origin_list)
        self.assertEqual(todo.project, self.origin)

    def test_changing_project_unclassifies_the_todo(self):
        """Test : a list of the project left behind cannot follow"""
        todo = self.make_todo("Ship it", todo_list=self.origin_list)

        response = self.client.post(
            f"/api/todos/{todo.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        todo.refresh_from_db()
        self.assertEqual(todo.project, self.destination)
        self.assertIsNone(todo.list)

    def test_move_into_a_list_of_the_destination_project(self):
        """Test : the caller may name a list of the project it moves into"""
        todo = self.make_todo("Ship it", todo_list=self.origin_list)

        response = self.client.post(
            f"/api/todos/{todo.id}/move/",
            {
                "project": str(self.destination.id),
                "list": str(self.destination_list.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        todo.refresh_from_db()
        self.assertEqual(todo.list, self.destination_list)

    def test_list_of_the_origin_project_rejected(self):
        """Test : the list must belong to the project being moved into"""
        todo = self.make_todo("Ship it")

        response = self.client.post(
            f"/api/todos/{todo.id}/move/",
            {"project": str(self.destination.id), "list": str(self.origin_list.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("list", response.data)
        todo.refresh_from_db()
        self.assertEqual(todo.project, self.origin)

    def test_move_to_a_foreign_project_denied(self):
        """Test : the destination project must belong to the caller"""
        todo = self.make_todo("Ship it")

        response = self.client.post(
            f"/api/todos/{todo.id}/move/",
            {"project": str(self.foreign.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_pin_survives_the_move(self):
        """Test : changing project keeps an explicit pin"""
        todo = self.make_todo("Ship it", is_pinned=True)

        self.client.post(
            f"/api/todos/{todo.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        todo.refresh_from_db()
        self.assertTrue(todo.is_pinned)


class FolderMoveTest(MoveTestCase):
    """Tests for POST /api/folders/{id}/move/"""

    def test_move_to_another_parent_of_the_same_project(self):
        """Test : without a project, the move is a change of parent"""
        folder = self.make_folder("Archives")
        target = self.make_folder("Vault")

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"parent": str(target.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folder.refresh_from_db()
        self.assertEqual(folder.parent, target)
        self.assertEqual(folder.project, self.origin)

    def test_move_to_the_root_of_another_project(self):
        """Test : a folder reaches the root of the destination project"""
        folder = self.make_folder("Archives")

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folder.refresh_from_db()
        self.assertEqual(folder.project, self.destination)
        self.assertIsNone(folder.parent)

    def test_the_whole_branch_follows(self):
        """Test : subfolders and documents travel with the folder"""
        folder = self.make_folder("Archives")
        child = self.make_folder("Nested", parent=folder)
        deep = self.make_folder("Deeper", parent=child)
        top = self.make_document("Top", folder=folder)
        nested = self.make_document("Nested doc", folder=child)
        deepest = self.make_document("Deep doc", folder=deep)

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        for entry in (child, deep, top, nested, deepest):
            entry.refresh_from_db()
            self.assertEqual(entry.project, self.destination)

        child.refresh_from_db()
        self.assertEqual(child.parent, folder)
        self.assertEqual(
            Document.objects.filter(project=self.origin).count(),
            0,
        )

    def test_a_snippet_branch_follows_too(self):
        """Test : the branch of a snippet folder carries its snippets"""
        folder = self.make_folder("Helpers", resource_type="snippets")
        child = self.make_folder("Nested", parent=folder, resource_type="snippets")
        nested = self.make_snippet("Helper", folder=child)

        self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        nested.refresh_from_db()
        self.assertEqual(nested.project, self.destination)

    def test_move_into_a_folder_of_another_project(self):
        """Test : a folder can land inside a folder of the destination"""
        folder = self.make_folder("Archives")
        target = self.make_folder("Vault", project=self.destination)

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id), "parent": str(target.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folder.refresh_from_db()
        self.assertEqual(folder.parent, target)
        self.assertEqual(folder.project, self.destination)

    def test_name_collision_at_the_destination_root_rejected(self):
        """Test : a taken name at the destination refuses the move"""
        folder = self.make_folder("Archives")
        self.make_folder("Archives", project=self.destination)

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)
        folder.refresh_from_db()
        self.assertEqual(folder.project, self.origin)

    def test_name_collision_inside_the_destination_folder_rejected(self):
        """Test : the check follows the destination parent"""
        folder = self.make_folder("Archives")
        target = self.make_folder("Vault", project=self.destination)
        self.make_folder("Archives", project=self.destination, parent=target)

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id), "parent": str(target.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_a_homonym_of_another_type_does_not_block_the_move(self):
        """Test : the root namespaces of the two types stay separate"""
        folder = self.make_folder("Utils")
        self.make_folder("Utils", project=self.destination, resource_type="snippets")

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_refused_move_leaves_the_branch_untouched(self):
        """Test : a rejected move moves nothing at all"""
        folder = self.make_folder("Archives")
        child = self.make_folder("Nested", parent=folder)
        document = self.make_document("Notes", folder=child)
        self.make_folder("Archives", project=self.destination)

        self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        for entry in (folder, child, document):
            entry.refresh_from_db()
            self.assertEqual(entry.project, self.origin)

    def test_move_into_a_folder_of_another_type_rejected(self):
        """Test : a branch cannot join one holding the other resource"""
        folder = self.make_folder("Archives")
        target = self.make_folder(
            "Helpers", project=self.destination, resource_type="snippets"
        )

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id), "parent": str(target.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", response.data)

    def test_move_into_itself_rejected(self):
        """Test : a folder cannot become its own parent"""
        folder = self.make_folder("Archives")

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"parent": str(folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", response.data)

    def test_move_into_a_descendant_rejected(self):
        """Test : a folder cannot slide under one of its own children"""
        folder = self.make_folder("Archives")
        child = self.make_folder("Nested", parent=folder)

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"parent": str(child.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", response.data)

    def test_move_to_a_foreign_project_denied(self):
        """Test : the destination project must belong to the caller"""
        folder = self.make_folder("Archives")

        response = self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.foreign.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        folder.refresh_from_db()
        self.assertEqual(folder.project, self.origin)

    def test_pinned_contents_keep_their_pin(self):
        """Test : the pins inside a moved branch are left alone"""
        folder = self.make_folder("Archives")
        document = self.make_document("Notes", folder=folder, is_pinned=True)

        self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        document.refresh_from_db()
        self.assertTrue(document.is_pinned)
        self.assertEqual(document.project, self.destination)

    def test_moved_branch_shows_up_in_the_destination_contents(self):
        """Test : the destination project serves the folder right away"""
        folder = self.make_folder("Archives")

        self.client.post(
            f"/api/folders/{folder.id}/move/",
            {"project": str(self.destination.id)},
            format="json",
        )

        response = self.client.get(f"/api/projects/{self.destination.id}/contents/")
        entries = response.data["results"]

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["type"], "folder")
        self.assertEqual(entries[0]["id"], str(folder.id))
