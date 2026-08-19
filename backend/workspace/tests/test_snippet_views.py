from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from workspace.models import Project, Snippet

User = get_user_model()


class SnippetViewTest(APITestCase):
    """Tests for Snippet API endpoints"""

    def setUp(self):
        """Create test users and projects"""
        self.user1 = User.objects.create_user(
            username="dev1", email="dev1@test.com", password="testpass123"
        )
        self.project1 = Project.objects.create(title="Project 1", user=self.user1)

        self.user2 = User.objects.create_user(
            username="dev2", email="dev2@test.com", password="testpass123"
        )
        self.project2 = Project.objects.create(title="Project 2", user=self.user2)

        self.snippet1 = Snippet.objects.create(
            title="Test Snippet",
            language="python",
            content='print("Hello")',
            project=self.project1,
        )

    def test_list_snippets_authenticated(self):
        """Test : Authenticated user can list their snippets"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get("/api/snippets/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and "results" in response.data:
            snippets = response.data["results"]
        else:
            snippets = response.data

        self.assertEqual(len(snippets), 1)
        self.assertEqual(snippets[0]["title"], "Test Snippet")
        self.assertEqual(snippets[0]["language"], "python")

    def test_list_snippets_unauthenticated(self):
        """Test : Unauthenticated request returns 401"""
        response = self.client.get("/api/snippets/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_snippets_nested(self):
        """Test : List snippets via nested route /api/projects/{id}/snippets"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f"/api/projects/{self.project1.id}/snippets/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and "results" in response.data:
            snippets = response.data["results"]
        else:
            snippets = response.data

        self.assertEqual(len(snippets), 1)
        self.assertEqual(snippets[0]["title"], "Test Snippet")

    def test_create_snippet_nested(self):
        """Test : Create snippet via nested route POST"""
        self.client.force_authenticate(user=self.user1)

        data = {
            "title": "New Snippet",
            "language": "javascript",
            "content": 'console.log("test");',
        }

        response = self.client.post(
            f"/api/projects/{self.project1.id}/snippets/", data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New Snippet")
        self.assertEqual(response.data["language"], "javascript")
        self.assertEqual(response.data["project_id"], str(self.project1.id))
        self.assertEqual(Snippet.objects.count(), 2)

    def test_create_snippet_flat_route_not_supported(self):
        """Test : POST on flat route /api/snippets/ is not supported
        (no project context)"""
        self.client.force_authenticate(user=self.user1)

        data = {
            "title": "Flat Route Snippet",
            "language": "python",
            "content": "def test(): pass",
        }

        response = self.client.post("/api/snippets/", data, format="json")

        # Flat route requires project_pk from URL — without it, access is denied
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_snippet(self):
        """Test : GET detail of a snippet"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f"/api/snippets/{self.snippet1.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.snippet1.id))
        self.assertEqual(response.data["title"], "Test Snippet")
        self.assertEqual(response.data["content"], 'print("Hello")')
        self.assertEqual(response.data["language"], "python")
        self.assertEqual(response.data["project_id"], str(self.project1.id))

    def test_update_snippet(self):
        """Test : PATCH update a snippet"""
        self.client.force_authenticate(user=self.user1)

        data = {
            "title": "Updated Snippet",
            "content": 'console.log("updated");',
            "language": "javascript",
        }

        response = self.client.patch(
            f"/api/snippets/{self.snippet1.id}/", data, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "Updated Snippet")
        self.assertEqual(response.data["content"], 'console.log("updated");')
        self.assertEqual(response.data["language"], "javascript")
        self.snippet1.refresh_from_db()
        self.assertEqual(self.snippet1.title, "Updated Snippet")
        self.assertEqual(self.snippet1.language, "javascript")

    def test_delete_snippet(self):
        """Test : DELETE remove a snippet"""
        self.client.force_authenticate(user=self.user1)

        snippet_id = self.snippet1.id
        response = self.client.delete(f"/api/snippets/{snippet_id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Snippet.objects.filter(id=snippet_id).exists())

    def test_user_isolation(self):
        """Test : User cannot access other user's snippets"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.get(f"/api/snippets/{self.snippet1.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # user2's project snippet should not be visible to user1
        snippet2 = Snippet.objects.create(
            title="Other Snippet",
            language="python",
            content="pass",
            project=self.project2,
        )
        response = self.client.get(f"/api/snippets/{snippet2.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_duplicate_snippet(self):
        """Test duplicating a snippet copies its code into the same project"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            f"/api/snippets/{self.snippet1.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test Snippet (copy)")
        self.assertEqual(response.data["content"], self.snippet1.content)
        self.assertEqual(response.data["project_id"], str(self.project1.id))
        self.assertNotEqual(response.data["id"], str(self.snippet1.id))

        self.assertEqual(Snippet.objects.count(), 2)

        self.snippet1.refresh_from_db()
        self.assertEqual(self.snippet1.title, "Test Snippet")

    def test_duplicate_snippet_nested_route(self):
        """Test duplicating a snippet through the project nested route"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            f"/api/projects/{self.project1.id}/snippets/{self.snippet1.id}/duplicate/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test Snippet (copy)")
        self.assertEqual(Snippet.objects.count(), 2)

    def test_duplicate_snippet_keeps_language_and_description(self):
        """Test the copy carries the language and description over"""
        self.client.force_authenticate(user=self.user1)

        snippet = Snippet.objects.create(
            title="Described Snippet",
            language="javascript",
            content="const a = 1;",
            description="A short description",
            project=self.project1,
        )

        response = self.client.post(
            f"/api/snippets/{snippet.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["language"], "javascript")
        self.assertEqual(response.data["description"], "A short description")

        copy = Snippet.objects.get(id=response.data["id"])
        self.assertEqual(copy.content, snippet.content)
        self.assertEqual(copy.project, snippet.project)

    def test_duplicate_snippet_numbers_further_copies(self):
        """Test duplicating twice in a row does not repeat the same title"""
        self.client.force_authenticate(user=self.user1)

        first = self.client.post(
            f"/api/snippets/{self.snippet1.id}/duplicate/", format="json"
        )
        second = self.client.post(
            f"/api/snippets/{self.snippet1.id}/duplicate/", format="json"
        )

        self.assertEqual(first.data["title"], "Test Snippet (copy)")
        self.assertEqual(second.data["title"], "Test Snippet (copy 2)")
        self.assertEqual(Snippet.objects.count(), 3)

    def test_duplicate_snippet_ignores_titles_of_other_projects(self):
        """Test the numbering only looks at the project holding the snippet"""
        self.client.force_authenticate(user=self.user1)

        Snippet.objects.create(
            title="Test Snippet (copy)",
            language="python",
            content="pass",
            project=self.project2,
        )

        response = self.client.post(
            f"/api/snippets/{self.snippet1.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test Snippet (copy)")

    def test_duplicate_snippet_truncates_long_title(self):
        """Test the copy title stays within the title max length"""
        self.client.force_authenticate(user=self.user1)

        max_length = Snippet._meta.get_field("title").max_length
        snippet = Snippet.objects.create(
            title="S" * max_length,
            language="python",
            content="pass",
            project=self.project1,
        )

        response = self.client.post(
            f"/api/snippets/{snippet.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["title"]), max_length)
        self.assertTrue(response.data["title"].endswith(" (copy)"))

    def test_duplicate_snippet_unauthenticated(self):
        """Test duplicating a snippet without authentication returns 401"""
        response = self.client.post(
            f"/api/snippets/{self.snippet1.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Snippet.objects.count(), 1)

    def test_duplicate_snippet_user_isolation(self):
        """Test that users cannot duplicate each other's snippets"""
        self.client.force_authenticate(user=self.user1)

        other_snippet = Snippet.objects.create(
            title="Other Snippet",
            language="python",
            content="pass",
            project=self.project2,
        )

        response = self.client.post(
            f"/api/snippets/{other_snippet.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Snippet.objects.filter(project=self.project2).count(), 1)

    def test_snippet_is_unpinned_on_create(self):
        """Test : a snippet created through the API starts unpinned"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            f"/api/projects/{self.project1.id}/snippets/",
            {
                "title": "Fresh Snippet",
                "language": "python",
                "content": 'print("Fresh")',
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["is_pinned"])

    def test_pin_snippet_through_patch(self):
        """Test : the generic snippet update toggles the pin"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.patch(
            f"/api/snippets/{self.snippet1.id}/", {"is_pinned": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_pinned"])

        self.snippet1.refresh_from_db()
        self.assertTrue(self.snippet1.is_pinned)

        response = self.client.patch(
            f"/api/snippets/{self.snippet1.id}/", {"is_pinned": False}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_pinned"])

        self.snippet1.refresh_from_db()
        self.assertFalse(self.snippet1.is_pinned)

    def test_pinning_changes_nothing_else(self):
        """Test : pinning leaves the rest of the snippet untouched"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.patch(
            f"/api/snippets/{self.snippet1.id}/", {"is_pinned": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.snippet1.refresh_from_db()
        self.assertTrue(self.snippet1.is_pinned)
        self.assertEqual(self.snippet1.title, "Test Snippet")
        self.assertEqual(self.snippet1.language, "python")
        self.assertEqual(self.snippet1.content, 'print("Hello")')
        self.assertEqual(self.snippet1.project, self.project1)

    def test_retrieve_snippet_exposes_is_pinned(self):
        """Test : the pin state is readable on a single snippet"""
        self.client.force_authenticate(user=self.user1)
        self.snippet1.is_pinned = True
        self.snippet1.save()

        response = self.client.get(f"/api/snippets/{self.snippet1.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_pinned"])

    def test_pinning_a_foreign_snippet_denied(self):
        """Test : users cannot pin each other's snippets"""
        self.client.force_authenticate(user=self.user1)

        other_snippet = Snippet.objects.create(
            title="Other Snippet",
            language="python",
            content="pass",
            project=self.project2,
        )

        response = self.client.patch(
            f"/api/snippets/{other_snippet.id}/", {"is_pinned": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        other_snippet.refresh_from_db()
        self.assertFalse(other_snippet.is_pinned)

    def test_duplicate_of_a_pinned_snippet_is_unpinned(self):
        """Test : a copy does not inherit the pin"""
        self.client.force_authenticate(user=self.user1)
        self.snippet1.is_pinned = True
        self.snippet1.save()

        response = self.client.post(
            f"/api/snippets/{self.snippet1.id}/duplicate/", format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["is_pinned"])


class SnippetPinnedViewTest(APITestCase):
    """Tests for the pinned snippets stream"""

    def setUp(self):
        """Create a user and a project holding snippets"""
        self.user = User.objects.create_user(
            username="pinneddev", email="pinneddev@test.com", password="TestPass123!"
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Pinned Snippet Project", user=self.user
        )

    def make_snippet(self, title, is_pinned=False, project=None):
        """Helper building a snippet in the test project"""
        return Snippet.objects.create(
            title=title,
            language="python",
            content=f'print("{title}")',
            project=project or self.project,
            is_pinned=is_pinned,
        )

    def test_pinned_lists_only_pinned_snippets(self):
        """Test : the stream carries the pinned snippets and nothing else"""
        pinned = self.make_snippet("Pinned", is_pinned=True)
        self.make_snippet("Plain")

        response = self.client.get(f"/api/projects/{self.project.id}/snippets/pinned/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(pinned.id))
        self.assertTrue(response.data["results"][0]["is_pinned"])

    def test_pinned_entries_use_the_snippet_shape(self):
        """Test : pinned entries render like any other snippet"""
        self.make_snippet("Pinned", is_pinned=True)

        response = self.client.get(f"/api/projects/{self.project.id}/snippets/pinned/")
        entry = response.data["results"][0]

        self.assertEqual(
            set(entry.keys()),
            {
                "id",
                "title",
                "content",
                "language",
                "description",
                "project_id",
                "is_pinned",
                "created_at",
                "updated_at",
            },
        )

    def test_pinned_snippet_stays_in_the_plain_listing(self):
        """Test : pinning is a shortcut, not a move"""
        pinned = self.make_snippet("Pinned", is_pinned=True)
        plain = self.make_snippet("Plain")

        response = self.client.get(f"/api/projects/{self.project.id}/snippets/")

        ids = {entry["id"] for entry in response.data["results"]}
        self.assertEqual(ids, {str(pinned.id), str(plain.id)})

    def test_pinned_is_empty_when_nothing_is_pinned(self):
        """Test : a project without pinned snippets returns an empty stream"""
        self.make_snippet("Plain")

        response = self.client.get(f"/api/projects/{self.project.id}/snippets/pinned/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(response.data["results"], [])

    def test_pinned_is_scoped_to_the_project(self):
        """Test : pinned snippets of another project are not listed"""
        other_project = Project.objects.create(
            title="Other Snippet Project", user=self.user
        )
        self.make_snippet("Elsewhere", is_pinned=True, project=other_project)
        mine = self.make_snippet("Mine", is_pinned=True)

        response = self.client.get(f"/api/projects/{self.project.id}/snippets/pinned/")

        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(mine.id))

    def test_pinned_of_foreign_project_is_empty(self):
        """Test : users cannot read another user's pinned snippets"""
        other_user = User.objects.create_user(
            username="pinnedforeigndev",
            email="pinnedforeigndev@test.com",
            password="OtherPass123!",
        )
        foreign_project = Project.objects.create(
            title="Foreign Snippet Project", user=other_user
        )
        self.make_snippet("Foreign", is_pinned=True, project=foreign_project)

        response = self.client.get(
            f"/api/projects/{foreign_project.id}/snippets/pinned/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_pinned_unauthenticated(self):
        """Test : the pinned stream requires authentication"""
        self.client.force_authenticate(user=None)

        response = self.client.get(f"/api/projects/{self.project.id}/snippets/pinned/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_pinned_is_paginated(self):
        """Test : the pinned stream follows the pagination shape"""
        for index in range(25):
            self.make_snippet(f"Pinned {index}", is_pinned=True)

        response = self.client.get(f"/api/projects/{self.project.id}/snippets/pinned/")

        self.assertEqual(
            set(response.data.keys()), {"count", "next", "previous", "results"}
        )
        self.assertEqual(response.data["count"], 25)
        self.assertEqual(len(response.data["results"]), 20)
