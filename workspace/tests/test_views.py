from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from workspace.models import Project

User = get_user_model()


class ProjectViewTest(APITestCase):
    """Tests for Project API views"""

    def setUp(self):
        """Helper to create a test user and authenticate"""
        self.user = User.objects.create_user(
            username='usertest',
            email='user@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            name='Test Project',
            description='A project for testing',
            user=self.user
        )

    def test_list_projects_authenticated(self):
        """Test listing projects when authenticated"""
        response = self.client.get('/api/projects/')

        # Status
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Automatic pagination/non-pagination management
        if isinstance(response.data, dict) and 'results' in response.data:
            projects = response.data['results']
            # Test pagination metadata
            self.assertEqual(response.data['count'], 1)
            self.assertIsNone(response.data['next'])
            self.assertIsNone(response.data['previous'])
        else:
            projects = response.data

        # Number of projects
        self.assertEqual(len(projects), 1)

        # Content of the project
        self.assertEqual(projects[0]['name'], self.project.name)
        self.assertEqual(projects[0]['description'], self.project.description)

        # Check UUID is present
        self.assertIn('id', projects[0])

    def test_list_projects_unauthenticated(self):
        """Test listing projects when unauthenticated"""
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/projects/')

        # Status
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_project(self):
        """Test creating a new project"""
        data = {
            'name': 'New Project',
            'description': 'A new test project'
        }
        response = self.client.post('/api/projects/', data)

        # Status
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify the project was created
        self.assertEqual(Project.objects.count(), 2)
        new_project = Project.objects.get(name='New Project')
        self.assertEqual(new_project.description, 'A new test project')
        self.assertEqual(new_project.user, self.user)

    def test_create_project_unauthenticated(self):
        """Test creating a project when unauthenticated"""
        self.client.force_authenticate(user=None)
        data = {
            'name': 'Unauthorized Project',
            'description': 'Should not be created'
        }
        response = self.client.post('/api/projects/', data)

        # Status
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Verify the project was not created
        self.assertEqual(Project.objects.count(), 1)

    def test_retrieve_project(self):
        """Test retrieving a specific project"""
        response = self.client.get(f'/api/projects/{self.project.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], self.project.name)
        self.assertEqual(response.data['description'], self.project.description)

    def test_update_project(self):
        """Test updating a project"""
        data = {
            'name': 'Updated Project',
            'description': 'Updated description'
        }
        response = self.client.put(f'/api/projects/{self.project.id}/', data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify the project was updated
        self.project.refresh_from_db()
        self.assertEqual(self.project.name, 'Updated Project')
        self.assertEqual(self.project.description, 'Updated description')

    def test_delete_project(self):
        """Test deleting a project"""
        response = self.client.delete(f'/api/projects/{self.project.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify the project was deleted
        self.assertEqual(Project.objects.count(), 0)

    def test_user_isolation(self):
        """Test that users cannot access each other's projects"""
        # Create a second user and project
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@test.com',
            password='OtherPass123!'
        )
        other_project = Project.objects.create(
            name='Other Project',
            description='A project for the other user',
            user=other_user
        )

        # Try to access other user's project
        response = self.client.get(f'/api/projects/{other_project.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Verify list only shows own projects
        response = self.client.get('/api/projects/')
        if isinstance(response.data, dict) and 'results' in response.data:
            projects = response.data['results']
        else:
            projects = response.data

        self.assertEqual(len(projects), 1)
        self.assertEqual(projects[0]['name'], self.project.name)
