from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from workspace.models import TODO, Project

User = get_user_model()


class ProjectViewTest(APITestCase):
    """Tests for Project API views"""

    def setUp(self):
        """Helper to create a test user and authenticate"""
        self.user = User.objects.create_user(
            username="usertest", email="user@test.com", password="TestPass123!"
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Test Project", description="A project for testing", user=self.user
        )

    def test_list_projects_authenticated(self):
        """Test listing projects when authenticated"""
        response = self.client.get("/api/projects/")

        # Status
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Automatic pagination/non-pagination management
        if isinstance(response.data, dict) and "results" in response.data:
            projects = response.data["results"]
            # Test pagination metadata
            self.assertEqual(response.data["count"], 1)
            self.assertIsNone(response.data["next"])
            self.assertIsNone(response.data["previous"])
        else:
            projects = response.data

        # Number of projects
        self.assertEqual(len(projects), 1)

        # Content of the project
        self.assertEqual(projects[0]["title"], self.project.title)
        self.assertEqual(projects[0]["description"], self.project.description)

        # Check UUID is present
        self.assertIn("id", projects[0])

    def test_list_projects_unauthenticated(self):
        """Test listing projects when unauthenticated"""
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/projects/")

        # Status
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_project(self):
        """Test creating a new project"""
        data = {"title": "New Project", "description": "A new test project"}
        response = self.client.post("/api/projects/", data)

        # Status
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify the project was created
        self.assertEqual(Project.objects.count(), 2)
        new_project = Project.objects.get(title="New Project")
        self.assertEqual(new_project.description, "A new test project")
        self.assertEqual(new_project.user, self.user)

    def test_create_project_unauthenticated(self):
        """Test creating a project when unauthenticated"""
        self.client.force_authenticate(user=None)
        data = {"title": "Unauthorized Project", "description": "Should not be created"}
        response = self.client.post("/api/projects/", data)

        # Status
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Verify the project was not created
        self.assertEqual(Project.objects.count(), 1)

    def test_retrieve_project(self):
        """Test retrieving a specific project"""
        response = self.client.get(f"/api/projects/{self.project.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], self.project.title)
        self.assertEqual(response.data["description"], self.project.description)

    def test_update_project(self):
        """Test updating a project"""
        data = {"title": "Updated Project", "description": "Updated description"}
        response = self.client.put(f"/api/projects/{self.project.id}/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify the project was updated
        self.project.refresh_from_db()
        self.assertEqual(self.project.title, "Updated Project")
        self.assertEqual(self.project.description, "Updated description")

    def test_delete_project(self):
        """Test deleting a project"""
        response = self.client.delete(f"/api/projects/{self.project.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify the project was deleted
        self.assertEqual(Project.objects.count(), 0)

    def test_user_isolation(self):
        """Test that users cannot access each other's projects"""
        # Create a second user and project
        other_user = User.objects.create_user(
            username="otheruser", email="other@test.com", password="OtherPass123!"
        )
        other_project = Project.objects.create(
            title="Other Project",
            description="A project for the other user",
            user=other_user,
        )

        # Try to access other user's project
        response = self.client.get(f"/api/projects/{other_project.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Verify list only shows own projects
        response = self.client.get("/api/projects/")
        if isinstance(response.data, dict) and "results" in response.data:
            projects = response.data["results"]
        else:
            projects = response.data

        self.assertEqual(len(projects), 1)
        self.assertEqual(projects[0]["title"], self.project.title)


class ProjectRecentViewTest(APITestCase):
    """Tests for the open/ and recent/ actions of the Project API"""

    def setUp(self):
        """Helper to create a test user, a project and authenticate"""
        self.user = User.objects.create_user(
            username="usertest", email="user@test.com", password="TestPass123!"
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(title="Alpha", user=self.user)

    def test_open_stamps_last_opened_at(self):
        """Test that opening a project stamps its last opening date"""
        self.assertIsNone(self.project.last_opened_at)

        response = self.client.post(f"/api/projects/{self.project.id}/open/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data["last_opened_at"])

        self.project.refresh_from_db()
        self.assertIsNotNone(self.project.last_opened_at)

    def test_recent_orders_by_last_opened_then_updated(self):
        """Test that recent projects come back opened-first, newest first"""
        beta = Project.objects.create(title="Beta", user=self.user)
        never_opened = Project.objects.create(title="Gamma", user=self.user)

        self.client.post(f"/api/projects/{self.project.id}/open/")
        self.client.post(f"/api/projects/{beta.id}/open/")

        response = self.client.get("/api/projects/recent/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [project["title"] for project in response.data]
        self.assertEqual(titles, ["Beta", "Alpha", "Gamma"])
        self.assertIsNone(response.data[2]["last_opened_at"])
        self.assertEqual(response.data[2]["title"], never_opened.title)

    def test_recent_honours_limit(self):
        """Test that ?limit= caps the number of projects returned"""
        for title in ["Beta", "Gamma", "Delta"]:
            Project.objects.create(title=title, user=self.user)

        response = self.client.get("/api/projects/recent/?limit=2")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_recent_rejects_invalid_limit(self):
        """Test that a non numeric ?limit= is refused"""
        response = self.client.get("/api/projects/recent/?limit=nope")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recent_and_open_are_isolated_per_user(self):
        """Test that a user cannot see or stamp the projects of another user"""
        other_user = User.objects.create_user(
            username="otheruser", email="other@test.com", password="OtherPass123!"
        )
        other_project = Project.objects.create(title="Other", user=other_user)

        response = self.client.post(f"/api/projects/{other_project.id}/open/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        other_project.refresh_from_db()
        self.assertIsNone(other_project.last_opened_at)

        response = self.client.get("/api/projects/recent/")
        titles = [project["title"] for project in response.data]
        self.assertEqual(titles, ["Alpha"])

    def test_open_todos_count_ignores_done_todos(self):
        """Test that the project counter only sums todos left to do"""
        TODO.objects.create(title="A", project=self.project, status="pending")
        TODO.objects.create(title="B", project=self.project, status="in_progress")
        TODO.objects.create(title="C", project=self.project, status="done")

        response = self.client.get("/api/projects/recent/")

        self.assertEqual(response.data[0]["open_todos_count"], 2)
