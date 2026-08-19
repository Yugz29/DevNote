from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from workspace.models import Folder, Project, Snippet

User = get_user_model()


def unwrap(response):
    """Return the list payload whether or not pagination is active"""
    if isinstance(response.data, dict) and "results" in response.data:
        return response.data["results"]
    return response.data


class SnippetFolderViewTest(APITestCase):
    """Tests for folders holding snippets, through the API"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="snippetfolderviewuser",
            email="snippetfolderview@test.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Snippet Folder View Project", user=self.user
        )
        self.snippet_folder = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )
        self.document_folder = Folder.objects.create(
            name="Archives", project=self.project
        )

    def make_snippet(self, title, folder=None, project=None):
        return Snippet.objects.create(
            title=title,
            content="pass",
            language="python",
            project=project or self.project,
            folder=folder,
        )

    def test_create_snippet_folder(self):
        """Test : a folder can be created for snippets"""
        response = self.client.post(
            f"/api/projects/{self.project.id}/folders/",
            {"name": "Fixtures", "resource_type": "snippets"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["resource_type"], "snippets")

    def test_folder_defaults_to_documents(self):
        """Test : an unqualified folder still holds documents"""
        response = self.client.post(
            f"/api/projects/{self.project.id}/folders/",
            {"name": "Drafts"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["resource_type"], "documents")

    def test_resource_type_is_immutable(self):
        """Test : a folder cannot be converted from one type to the other"""
        response = self.client.patch(
            f"/api/folders/{self.snippet_folder.id}/",
            {"resource_type": "documents"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("resource_type", response.data)

        self.snippet_folder.refresh_from_db()
        self.assertEqual(self.snippet_folder.resource_type, "snippets")

    def test_filter_folders_by_resource_type(self):
        """Test : the listing narrows to one kind of folder"""
        response = self.client.get(
            f"/api/projects/{self.project.id}/folders/",
            {"resource_type": "snippets"},
        )

        entries = unwrap(response)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["id"], str(self.snippet_folder.id))

    def test_unfiltered_listing_returns_both_types(self):
        """Test : without the filter, the listing spans every folder"""
        response = self.client.get(f"/api/projects/{self.project.id}/folders/")

        ids = {entry["id"] for entry in unwrap(response)}

        self.assertEqual(
            ids, {str(self.snippet_folder.id), str(self.document_folder.id)}
        )

    def test_invalid_resource_type_rejected(self):
        """Test : an unknown resource type is a bad request"""
        response = self.client.get(
            f"/api/projects/{self.project.id}/folders/",
            {"resource_type": "todos"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("resource_type", response.data)

    def test_folders_of_both_types_may_share_a_name(self):
        """Test : each type has its own root namespace"""
        response = self.client.post(
            f"/api/projects/{self.project.id}/folders/",
            {"name": "Archives", "resource_type": "snippets"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_nested_folder_inherits_the_type_of_its_parent(self):
        """Test : a subfolder of a snippet folder holds snippets"""
        response = self.client.post(
            f"/api/projects/{self.project.id}/folders/",
            {
                "name": "Nested",
                "parent": str(self.snippet_folder.id),
                "resource_type": "snippets",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["resource_type"], "snippets")

    def test_nesting_across_types_rejected(self):
        """Test : a branch cannot mix documents and snippets"""
        response = self.client.post(
            f"/api/projects/{self.project.id}/folders/",
            {"name": "Nested", "parent": str(self.snippet_folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", response.data)


class SnippetFolderContentsTest(APITestCase):
    """Tests for the contents streams of snippet folders"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="snippetcontentsuser",
            email="snippetcontents@test.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Snippet Contents Project", user=self.user
        )
        self.folder = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )

    def make_snippet(self, title, folder=None):
        return Snippet.objects.create(
            title=title,
            content="pass",
            language="python",
            project=self.project,
            folder=folder,
        )

    def test_root_contents_lists_snippet_folders_then_snippets(self):
        """Test : the root stream carries folders first, then loose snippets"""
        loose = self.make_snippet("Loose")
        self.make_snippet("Nested", folder=self.folder)

        response = self.client.get(
            f"/api/projects/{self.project.id}/contents/",
            {"resource_type": "snippets"},
        )
        entries = unwrap(response)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [(entry["type"], entry["id"]) for entry in entries],
            [("folder", str(self.folder.id)), ("snippet", str(loose.id))],
        )

    def test_root_contents_ignores_the_folders_of_the_other_type(self):
        """Test : a documents folder never shows up in the snippet stream"""
        Folder.objects.create(name="Archives", project=self.project)

        response = self.client.get(
            f"/api/projects/{self.project.id}/contents/",
            {"resource_type": "snippets"},
        )
        ids = {entry["id"] for entry in unwrap(response)}

        self.assertEqual(ids, {str(self.folder.id)})

    def test_root_contents_still_defaults_to_documents(self):
        """Test : the stream without a resource type is unchanged"""
        self.make_snippet("Loose")

        response = self.client.get(f"/api/projects/{self.project.id}/contents/")

        self.assertEqual(unwrap(response), [])

    def test_snippet_entries_carry_the_snippet_shape(self):
        """Test : a snippet entry renders like any other snippet"""
        self.make_snippet("Loose")

        response = self.client.get(
            f"/api/projects/{self.project.id}/contents/",
            {"resource_type": "snippets"},
        )
        entry = next(item for item in unwrap(response) if item["type"] == "snippet")

        self.assertEqual(
            set(entry.keys()),
            {
                "type",
                "id",
                "title",
                "content",
                "language",
                "description",
                "project_id",
                "folder",
                "is_pinned",
                "created_at",
                "updated_at",
            },
        )

    def test_folder_contents_lists_its_snippets(self):
        """Test : a snippet folder serves its snippets without a parameter"""
        nested = self.make_snippet("Nested", folder=self.folder)
        self.make_snippet("Loose")

        response = self.client.get(f"/api/folders/{self.folder.id}/contents/")
        entries = unwrap(response)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["type"], "snippet")
        self.assertEqual(entries[0]["id"], str(nested.id))

    def test_folder_counts_reach_the_gallery_card(self):
        """Test : a snippet folder reports what it holds"""
        child = Folder.objects.create(
            name="Nested",
            project=self.project,
            parent=self.folder,
            resource_type="snippets",
        )
        self.make_snippet("First", folder=self.folder)
        self.make_snippet("Second", folder=self.folder)
        self.make_snippet("Deeper", folder=child)

        response = self.client.get(
            f"/api/projects/{self.project.id}/contents/",
            {"resource_type": "snippets"},
        )
        entry = unwrap(response)[0]

        self.assertEqual(entry["folder_count"], 1)
        self.assertEqual(entry["snippet_count"], 2)
        self.assertEqual(entry["document_count"], 0)

    def test_delete_non_empty_snippet_folder_requires_confirmation(self):
        """Test : the 409 reports the snippets a delete would take along"""
        self.make_snippet("Nested", folder=self.folder)

        response = self.client.delete(f"/api/folders/{self.folder.id}/")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "folder_not_empty")
        self.assertEqual(response.data["snippets"], 1)
        self.assertEqual(response.data["documents"], 0)
        self.assertIn("1 snippet(s)", response.data["detail"])
        self.assertTrue(Folder.objects.filter(id=self.folder.id).exists())

    def test_delete_non_empty_snippet_folder_with_confirmation(self):
        """Test : confirming removes the folder and its snippets"""
        self.make_snippet("Nested", folder=self.folder)

        response = self.client.delete(f"/api/folders/{self.folder.id}/?confirm=true")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Folder.objects.filter(id=self.folder.id).exists())
        self.assertEqual(Snippet.objects.count(), 0)


class SnippetFolderFieldViewTest(APITestCase):
    """Tests for the folder of a snippet, through the API"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="snippetfieldviewuser",
            email="snippetfieldview@test.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Snippet Field Project", user=self.user
        )
        self.folder = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )
        self.document_folder = Folder.objects.create(
            name="Archives", project=self.project
        )

    def make_snippet(self, title, folder=None):
        return Snippet.objects.create(
            title=title,
            content="pass",
            language="python",
            project=self.project,
            folder=folder,
        )

    def test_project_snippets_still_returns_every_snippet(self):
        """Test : the flat listing spans the folders"""
        self.make_snippet("Loose")
        self.make_snippet("Nested", folder=self.folder)

        response = self.client.get(f"/api/projects/{self.project.id}/snippets/")

        self.assertEqual(len(unwrap(response)), 2)

    def test_filter_snippets_by_folder(self):
        """Test : ?folder=<uuid> narrows to one folder"""
        nested = self.make_snippet("Nested", folder=self.folder)
        self.make_snippet("Loose")

        response = self.client.get(
            f"/api/projects/{self.project.id}/snippets/",
            {"folder": str(self.folder.id)},
        )
        entries = unwrap(response)

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["id"], str(nested.id))

    def test_filter_snippets_at_root(self):
        """Test : ?folder=null narrows to the snippets of the project root"""
        loose = self.make_snippet("Loose")
        self.make_snippet("Nested", folder=self.folder)

        response = self.client.get(
            f"/api/projects/{self.project.id}/snippets/", {"folder": "null"}
        )
        entries = unwrap(response)

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["id"], str(loose.id))

    def test_filter_snippets_by_invalid_folder(self):
        """Test : a malformed folder id is a bad request"""
        response = self.client.get(
            f"/api/projects/{self.project.id}/snippets/", {"folder": "not-a-uuid"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_snippet_in_folder(self):
        """Test : a snippet can be created inside a folder"""
        response = self.client.post(
            f"/api/projects/{self.project.id}/snippets/",
            {
                "title": "Helper",
                "content": "pass",
                "language": "python",
                "folder": str(self.folder.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["folder"], self.folder.id)

    def test_move_snippet_into_folder(self):
        """Test : moving a snippet is a patch on its folder"""
        snippet = self.make_snippet("Loose")

        response = self.client.patch(
            f"/api/snippets/{snippet.id}/",
            {"folder": str(self.folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        snippet.refresh_from_db()
        self.assertEqual(snippet.folder, self.folder)

    def test_move_snippet_back_to_root(self):
        """Test : a null folder brings the snippet back to the project root"""
        snippet = self.make_snippet("Nested", folder=self.folder)

        response = self.client.patch(
            f"/api/snippets/{snippet.id}/", {"folder": None}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        snippet.refresh_from_db()
        self.assertIsNone(snippet.folder)

    def test_move_snippet_into_a_document_folder_rejected(self):
        """Test : a snippet cannot land in a folder holding documents"""
        snippet = self.make_snippet("Loose")

        response = self.client.patch(
            f"/api/snippets/{snippet.id}/",
            {"folder": str(self.document_folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("folder", response.data)

    def test_move_snippet_to_a_foreign_folder_rejected(self):
        """Test : the destination folder must belong to the caller"""
        stranger = User.objects.create_user(
            username="snippetfieldstranger",
            email="snippetfieldstranger@test.com",
            password="TestPass123!",
        )
        stranger_project = Project.objects.create(title="Stranger", user=stranger)
        stranger_folder = Folder.objects.create(
            name="Private", project=stranger_project, resource_type="snippets"
        )
        snippet = self.make_snippet("Loose")

        response = self.client.patch(
            f"/api/snippets/{snippet.id}/",
            {"folder": str(stranger_folder.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_keeps_the_folder(self):
        """Test : a copy lands beside the snippet it was made from"""
        snippet = self.make_snippet("Helper", folder=self.folder)

        response = self.client.post(
            f"/api/snippets/{snippet.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["folder"], self.folder.id)
        self.assertEqual(response.data["title"], "Helper (copy)")

    def test_duplicate_numbers_within_the_folder_only(self):
        """Test : a homonym in another folder does not shift the copy name"""
        self.make_snippet("Helper (copy)")
        snippet = self.make_snippet("Helper", folder=self.folder)

        response = self.client.post(
            f"/api/snippets/{snippet.id}/duplicate/", format="json"
        )

        self.assertEqual(response.data["title"], "Helper (copy)")

    def test_pinned_spans_the_folders(self):
        """Test : a pinned snippet shows up wherever it sits"""
        nested = self.make_snippet("Nested", folder=self.folder)
        nested.is_pinned = True
        nested.save()

        response = self.client.get(f"/api/projects/{self.project.id}/snippets/pinned/")
        entries = unwrap(response)

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["id"], str(nested.id))
