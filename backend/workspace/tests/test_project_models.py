from django.test import TestCase
from django.contrib.auth import get_user_model
from workspace.models import Project

User = get_user_model()

class ProjectModelTest(TestCase):
    """Tests for the Project model"""

    def setUp(self):
        """Preparation: create a test user"""
        self.user = User.objects.create_user(
            username='usertest',
            email='user@test.com',
            password='TestPass123!'
        )

    def test_create_project(self):
        """Test creating a project"""
        project = Project.objects.create(
            title='Test Project',
            description='A project for testing purposes.',
            user=self.user
        )

        self.assertEqual(project.title, 'Test Project')
        self.assertEqual(project.user, self.user)
        self.assertIsNotNone(project.created_at)

    def test_timestamps_auto_generated(self):
        """Test that created_at and updated_at are auto-generated"""
        project = Project.objects.create(
            title='Timestamp Test Project',
            user=self.user
        )

        self.assertIsNotNone(project.created_at)
        self.assertIsNotNone(project.updated_at)
        self.assertAlmostEqual(
            project.created_at.timestamp(),
            project.updated_at.timestamp(),
            delta=1
        )