from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from workspace.models import TODO, Project

User = get_user_model()


class TODOViewTest(APITestCase):
    """Test for Todo API views"""

    def setUp(self):
        """Create test users and projects"""
        self.user1 = User.objects.create_user(
            username="dev1", email="dev1@test.com", password="testpass123"
        )
        self.project1 = Project.objects.create(title="Project 1", user=self.user1)

        self.todo1 = TODO.objects.create(
            title="Test Todo 1", description="Test D Todo 1", project=self.project1
        )

        self.user2 = User.objects.create_user(
            username="dev2", email="dev2@test.com", password="testpass123"
        )
        self.project2 = Project.objects.create(title="Project 2", user=self.user2)

        self.todo2 = TODO.objects.create(
            title="Test Todo 2", description="Test D Todo 2", project=self.project2
        )

    def test_list_todos_authenticated(self):
        """Test : authenticated user can list their todos"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get("/api/todos/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and "results" in response.data:
            todos = response.data["results"]
        else:
            todos = response.data

        self.assertEqual(len(todos), 1)
        self.assertEqual(todos[0]["title"], "Test Todo 1")
        self.assertEqual(todos[0]["description"], "Test D Todo 1")

    def test_list_todos_unauthenticated(self):
        """Test : Unauthenticated request to list todos returns 401"""
        response = self.client.get("/api/todos/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_todos_nested(self):
        """Test : List todos via nested route /api/projects/{id}/todos"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f"/api/projects/{self.project1.id}/todos/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and "results" in response.data:
            todos = response.data["results"]
        else:
            todos = response.data

        self.assertEqual(len(todos), 1)
        self.assertEqual(todos[0]["title"], "Test Todo 1")

    def test_create_todo_nested(self):
        """Test : Create todo via nested route POST"""
        self.client.force_authenticate(user=self.user1)

        data = {"title": "New Todo List", "description": "New D Todo List"}

        response = self.client.post(
            f"/api/projects/{self.project1.id}/todos/", data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New Todo List")
        self.assertEqual(response.data["description"], "New D Todo List")
        self.assertEqual(response.data["project_id"], str(self.project1.id))
        self.assertEqual(TODO.objects.count(), 3)

    def test_create_todo_flat_route_not_supported(self):
        """Test : POST on flat route /api/todos/ is not supported
        (no project context)"""
        self.client.force_authenticate(user=self.user1)

        data = {
            "title": "Flat Route Todo",
            "description": "No project context",
        }

        response = self.client.post("/api/todos/", data, format="json")

        # Flat route requires project_pk from URL — without it, access is denied
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_todo(self):
        """Test : GET detail of a todo"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f"/api/todos/{self.todo1.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.todo1.id))
        self.assertEqual(response.data["title"], "Test Todo 1")
        self.assertEqual(response.data["description"], "Test D Todo 1")
        self.assertEqual(response.data["project_id"], str(self.project1.id))
        self.assertNotIn("project", response.data)

    def test_update_todo(self):
        """Test : PATCH update a todo"""
        self.client.force_authenticate(user=self.user1)

        data = {"title": "Updated Todo", "description": "Updated Description Todo"}

        response = self.client.patch(
            f"/api/todos/{self.todo1.id}/", data, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "Updated Todo")
        self.assertEqual(response.data["description"], "Updated Description Todo")
        self.todo1.refresh_from_db()
        self.assertEqual(self.todo1.title, "Updated Todo")
        self.assertEqual(self.todo1.description, "Updated Description Todo")

    def test_delete_todo(self):
        """Test : DELETE remove a todo"""
        self.client.force_authenticate(user=self.user1)

        todo_id = self.todo1.id
        response = self.client.delete(f"/api/todos/{todo_id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(TODO.objects.filter(id=todo_id).exists())

    def test_user_isolation(self):
        """Test : User cannot access other user's TODOs"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.get(f"/api/todos/{self.todo2.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_user_todo(self):
        """Test : User cannot update other user's TODOs"""
        self.client.force_authenticate(user=self.user1)

        data = {"title": "Hacked TODO"}
        response = self.client.patch(
            f"/api/todos/{self.todo2.id}/", data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_other_user_todo(self):
        """Test : User cannot delete other user's TODOs"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.delete(f"/api/todos/{self.todo2.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(TODO.objects.filter(id=self.todo2.id).exists())

    def test_filter_by_status(self):
        """Test : Filter TODOs by status"""
        self.client.force_authenticate(user=self.user1)

        TODO.objects.create(title="Done TODO", project=self.project1, status="done")
        TODO.objects.create(
            title="In Progress TODO", project=self.project1, status="in_progress"
        )

        response = self.client.get("/api/todos/?status=done")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and "results" in response.data:
            todos = response.data["results"]
        else:
            todos = response.data

        self.assertEqual(len(todos), 1)
        self.assertEqual(todos[0]["status"], "done")

    def test_filter_by_priority(self):
        """Test : Filter TODOs by priority"""
        self.client.force_authenticate(user=self.user1)

        TODO.objects.create(
            title="High Priority", project=self.project1, priority="high"
        )
        TODO.objects.create(title="Low Priority", project=self.project1, priority="low")

        response = self.client.get("/api/todos/?priority=high")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and "results" in response.data:
            todos = response.data["results"]
        else:
            todos = response.data

        self.assertEqual(len(todos), 1)
        self.assertEqual(todos[0]["priority"], "high")

    def test_create_todo_missing_title(self):
        """Test : Cannot create Todo without title"""
        self.client.force_authenticate(user=self.user1)

        data = {"description": "No title"}

        response = self.client.post(
            f"/api/projects/{self.project1.id}/todos/", data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

    def test_create_todo_invalid_status(self):
        """Test : Cannot create Todo with invalid status"""
        self.client.force_authenticate(user=self.user1)

        data = {"title": "Invalid Status", "status": "invalid_status"}

        response = self.client.post(
            f"/api/projects/{self.project1.id}/todos/", data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

    def test_create_todo_with_invalid_priority(self):
        """Test : Cannot create Todo with invalid priority"""
        self.client.force_authenticate(user=self.user1)

        data = {"title": "Invalid Priority", "priority": "invalid_priority"}

        response = self.client.post(
            f"/api/projects/{self.project1.id}/todos/", data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("priority", response.data)


class TODOPinnedViewTest(APITestCase):
    """Tests for the pinned TODOs stream"""

    def setUp(self):
        """Create a user and a project holding todos"""
        self.user = User.objects.create_user(
            username="pinnedtododev",
            email="pinnedtododev@test.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Pinned Todo Project", user=self.user
        )

    def make_todo(self, title, is_pinned=False, project=None, todo_status="pending"):
        """Helper building a todo in the test project"""
        return TODO.objects.create(
            title=title,
            project=project or self.project,
            status=todo_status,
            is_pinned=is_pinned,
        )

    def test_todo_is_unpinned_on_create(self):
        """Test : a todo created through the API starts unpinned"""
        response = self.client.post(
            f"/api/projects/{self.project.id}/todos/",
            {"title": "Fresh TODO"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["is_pinned"])

    def test_pin_todo_through_patch(self):
        """Test : the generic todo update toggles the pin"""
        todo = self.make_todo("Pin me")

        response = self.client.patch(
            f"/api/todos/{todo.id}/", {"is_pinned": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_pinned"])

        todo.refresh_from_db()
        self.assertTrue(todo.is_pinned)

        response = self.client.patch(
            f"/api/todos/{todo.id}/", {"is_pinned": False}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_pinned"])

        todo.refresh_from_db()
        self.assertFalse(todo.is_pinned)

    def test_pinning_changes_nothing_else(self):
        """Test : pinning leaves the rest of the todo untouched"""
        todo = self.make_todo("Untouched", todo_status="in_progress")

        response = self.client.patch(
            f"/api/todos/{todo.id}/", {"is_pinned": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        todo.refresh_from_db()
        self.assertTrue(todo.is_pinned)
        self.assertEqual(todo.title, "Untouched")
        self.assertEqual(todo.status, "in_progress")
        self.assertEqual(todo.project, self.project)

    def test_pinned_lists_only_pinned_todos(self):
        """Test : the stream carries the pinned todos and nothing else"""
        pinned = self.make_todo("Pinned", is_pinned=True)
        self.make_todo("Plain")

        response = self.client.get(f"/api/projects/{self.project.id}/todos/pinned/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(pinned.id))
        self.assertTrue(response.data["results"][0]["is_pinned"])

    def test_pinned_entries_carry_the_status(self):
        """Test : pinned entries render like any other todo, status included"""
        self.make_todo("Pinned", is_pinned=True, todo_status="done")

        response = self.client.get(f"/api/projects/{self.project.id}/todos/pinned/")
        entry = response.data["results"][0]

        self.assertEqual(entry["status"], "done")
        self.assertEqual(
            set(entry.keys()),
            {
                "id",
                "title",
                "description",
                "status",
                "priority",
                "project_id",
                "list",
                "due_date",
                "is_pinned",
                "created_at",
                "updated_at",
            },
        )

    def test_pinned_todo_stays_in_the_plain_listing(self):
        """Test : pinning is a shortcut, not a move"""
        pinned = self.make_todo("Pinned", is_pinned=True)
        plain = self.make_todo("Plain")

        response = self.client.get(f"/api/projects/{self.project.id}/todos/")

        ids = {entry["id"] for entry in response.data["results"]}
        self.assertEqual(ids, {str(pinned.id), str(plain.id)})

    def test_pinned_is_scoped_to_the_project(self):
        """Test : pinned todos of another project are not listed"""
        other_project = Project.objects.create(
            title="Other Todo Project", user=self.user
        )
        self.make_todo("Elsewhere", is_pinned=True, project=other_project)
        mine = self.make_todo("Mine", is_pinned=True)

        response = self.client.get(f"/api/projects/{self.project.id}/todos/pinned/")

        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(mine.id))

    def test_pinned_of_foreign_project_is_refused(self):
        """Test : users cannot read another user's pinned todos

        Project-scoped viewsets refuse an unowned project outright, where the
        snippet stream answers with an empty page.
        """
        other_user = User.objects.create_user(
            username="pinnedforeigntododev",
            email="pinnedforeigntododev@test.com",
            password="OtherPass123!",
        )
        foreign_project = Project.objects.create(
            title="Foreign Todo Project", user=other_user
        )
        self.make_todo("Foreign", is_pinned=True, project=foreign_project)

        response = self.client.get(f"/api/projects/{foreign_project.id}/todos/pinned/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_pinned_unauthenticated(self):
        """Test : the pinned stream requires authentication"""
        self.client.force_authenticate(user=None)

        response = self.client.get(f"/api/projects/{self.project.id}/todos/pinned/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
