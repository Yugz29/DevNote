from django.test import TestCase
from django.contrib.auth import get_user_model
from workspace.models import Project, TODO
from uuid import UUID

User = get_user_model()


class TODOModelTest(TestCase):
    """Test for the Todo model"""

    def setUp(self):
        """Preparation : create a test user and a project"""
        self.user = User.objects.create_user(
            email='user@test.com',
            password='TestPass123!'
        )
        self.project = Project.objects.create(
            title='TODO Test Project',
            description='A project for TODO testing.',
            user=self.user
        )

    def test_create_todo_with_defaults(self):
        """Test creating a Todo with default status and priority"""
        todo = TODO.objects.create(
            title='Test Todo',
            description='Description Todo',
            project=self.project
        )

        self.assertEqual(todo.title, 'Test Todo')
        self.assertEqual(todo.description, 'Description Todo')
        self.assertEqual(todo.status, 'pending')
        self.assertEqual(todo.priority, 'medium')
        self.assertEqual(todo.project, self.project)
        self.assertIsNotNone(todo.updated_at)
        self.assertIsInstance(todo.id, UUID)
    
    def test_todo_status_choices(self):
        """Test that status field accepts valid choices"""
        todo = TODO.objects.create(
            title='Test Todo',
            status='done',
            project=self.project
        )

        self.assertEqual(todo.status, 'done')
        self.assertEqual(todo.get_status_display(), 'Done')
    
    def test_todo_priority_choices(self):
        """Test that priority field accepts valid choices"""
        todo = TODO.objects.create(
            title='Test Todo',
            priority='low',
            project=self.project
        )

        self.assertEqual(todo.priority, 'low')
        self.assertEqual(todo.get_priority_display(), 'Low')
    
    def test_todo_str_representation(self):
        """Test the string representation of Todo"""
        todo = TODO.objects.create(
            title='My First TODO',
            status='in_progress',
            project=self.project
        )

        self.assertEqual(str(todo), 'My First TODO (In Progress)')
    
    def test_todo_ordering(self):
        """Test that TODOs are ordered by creation date (newest first)"""
        todo1 = TODO.objects.create(title='First TODO', project=self.project)
        todo2 = TODO.objects.create(title='Second TODO', project=self.project)
        todo3 = TODO.objects.create(title='Third TODO', project=self.project)

        todos = TODO.objects.all()

        self.assertEqual(todos[0], todo3)
        self.assertEqual(todos[1], todo2)
        self.assertEqual(todos[2], todo1)
