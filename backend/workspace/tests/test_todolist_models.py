from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from workspace.models import Project, TODO, TodoList
from uuid import UUID

User = get_user_model()


class TodoListModelTest(TestCase):
    """Tests for the TodoList model"""

    def setUp(self):
        """Preparation: create a test user and a project"""
        self.user = User.objects.create_user(
            username='listtestuser',
            email='list@test.com',
            password='TestPass123!'
        )
        self.project = Project.objects.create(
            title='List Test Project',
            description='A project for todo list testing.',
            user=self.user
        )

    def test_create_todo_list(self):
        """Test : create a todo list"""
        todo_list = TodoList.objects.create(name='Sprint 1', project=self.project)

        self.assertEqual(todo_list.name, 'Sprint 1')
        self.assertEqual(todo_list.project, self.project)
        self.assertIsNotNone(todo_list.created_at)
        self.assertIsNotNone(todo_list.updated_at)
        self.assertIsInstance(todo_list.id, UUID)

    def test_str_returns_the_name(self):
        """Test : string representation is the list name"""
        todo_list = TodoList.objects.create(name='Backlog', project=self.project)

        self.assertEqual(str(todo_list), 'Backlog')

    def test_lists_are_ordered_by_name_under_the_permanent_one(self):
        """Test : the built-in list leads, the rest come out alphabetically"""
        TodoList.objects.create(name='Later', project=self.project)
        TodoList.objects.create(name='Backlog', project=self.project)
        TodoList.objects.create(name='Sprint 1', project=self.project)

        names = list(
            TodoList.objects.filter(project=self.project).values_list('name', flat=True)
        )
        self.assertEqual(
            names, ['Top priorities', 'Backlog', 'Later', 'Sprint 1']
        )

    def test_name_is_unique_within_a_project(self):
        """Test : two lists of a project cannot share a name"""
        TodoList.objects.create(name='Backlog', project=self.project)

        with self.assertRaises(ValidationError):
            TodoList.objects.create(name='Backlog', project=self.project)

    def test_same_name_allowed_in_another_project(self):
        """Test : the name only has to be unique inside its own project"""
        other_project = Project.objects.create(
            title='Other List Project', user=self.user
        )
        TodoList.objects.create(name='Backlog', project=self.project)
        twin = TodoList.objects.create(name='Backlog', project=other_project)

        self.assertEqual(TodoList.objects.filter(name='Backlog').count(), 2)
        self.assertEqual(twin.project, other_project)

    def test_empty_name_rejected(self):
        """Test : a list needs a name"""
        with self.assertRaises(ValidationError):
            TodoList.objects.create(name='', project=self.project)

    def test_name_max_length(self):
        """Test : name cannot exceed 255 characters"""
        with self.assertRaises(ValidationError):
            TodoList.objects.create(name='a' * 256, project=self.project)

    def test_deleting_the_project_deletes_its_lists(self):
        """Test : lists belong to their project"""
        TodoList.objects.create(name='Backlog', project=self.project)

        self.project.delete()

        self.assertEqual(TodoList.objects.count(), 0)

    def test_todo_is_unclassified_by_default(self):
        """Test : a todo created without a list has none"""
        todo = TODO.objects.create(title='Loose end', project=self.project)

        self.assertIsNone(todo.list)

    def test_todo_can_belong_to_a_list(self):
        """Test : a todo can be filed into a list"""
        todo_list = TodoList.objects.create(name='Sprint 1', project=self.project)
        todo = TODO.objects.create(
            title='Filed', project=self.project, list=todo_list
        )
        todo.refresh_from_db()

        self.assertEqual(todo.list, todo_list)
        self.assertEqual(list(todo_list.todos.all()), [todo])

    def test_deleting_a_list_unclassifies_its_todos(self):
        """Test : todos survive the deletion of their list"""
        todo_list = TodoList.objects.create(name='Sprint 1', project=self.project)
        todo = TODO.objects.create(
            title='Filed', project=self.project, list=todo_list
        )

        todo_list.delete()
        todo.refresh_from_db()

        self.assertIsNone(todo.list)
        self.assertEqual(TODO.objects.count(), 1)

    def test_a_project_is_born_with_a_permanent_list(self):
        """Test : creating a project creates its built-in list"""
        project = Project.objects.create(title='Fresh', user=self.user)

        lists = TodoList.objects.filter(project=project)
        self.assertEqual(lists.count(), 1)
        self.assertEqual(lists.first().name, TodoList.PERMANENT_NAME)
        self.assertTrue(lists.first().is_permanent)

    def test_saving_a_project_again_adds_nothing(self):
        """Test : the built-in list is created once, not on every save"""
        project = Project.objects.create(title='Fresh', user=self.user)

        project.title = 'Renamed'
        project.save()

        self.assertEqual(TodoList.objects.filter(project=project).count(), 1)

    def test_a_project_cannot_hold_two_permanent_lists(self):
        """Test : the built-in list is unique within its project"""
        with self.assertRaises(ValidationError):
            TodoList.objects.create(
                name='Another one', project=self.project, is_permanent=True
            )

    def test_ensure_permanent_returns_the_existing_one(self):
        """Test : the helper never creates a second list"""
        existing = TodoList.objects.get(
            project=self.project, is_permanent=True
        )

        self.assertEqual(
            TodoList.ensure_permanent(self.project).id, existing.id
        )
        self.assertEqual(
            TodoList.objects.filter(
                project=self.project, is_permanent=True
            ).count(),
            1
        )

    def test_ensure_permanent_recreates_a_missing_one(self):
        """Test : the helper covers a project that somehow lost it"""
        TodoList.objects.filter(
            project=self.project, is_permanent=True
        ).delete()

        recreated = TodoList.ensure_permanent(self.project)

        self.assertTrue(recreated.is_permanent)
        self.assertEqual(recreated.name, TodoList.PERMANENT_NAME)

    def test_the_permanent_list_can_be_renamed(self):
        """Test : renaming does not cost it its flag"""
        todo_list = TodoList.objects.get(
            project=self.project, is_permanent=True
        )

        todo_list.name = 'Urgent'
        todo_list.save()
        todo_list.refresh_from_db()

        self.assertEqual(todo_list.name, 'Urgent')
        self.assertTrue(todo_list.is_permanent)

    def test_a_regular_list_is_not_flagged(self):
        """Test : lists made by hand are ordinary"""
        todo_list = TodoList.objects.create(
            name='Sprint 1', project=self.project
        )

        self.assertFalse(todo_list.is_permanent)
