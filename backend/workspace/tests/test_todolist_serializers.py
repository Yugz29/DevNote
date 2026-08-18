from types import SimpleNamespace
from django.test import TestCase
from django.contrib.auth import get_user_model
from workspace.models import Project, TODO, TodoList
from workspace.serializers import TodoListSerializer, TODOSerializer

User = get_user_model()


class TodoListSerializerTestCase(TestCase):
    """Test suite for TodoListSerializer"""

    def setUp(self):
        """Set up test user and project"""
        self.user = User.objects.create_user(
            email='listserializer@example.com',
            password='testpass123'
        )
        self.project = Project.objects.create(
            title='List Serializer Project',
            user=self.user
        )

    def get_serializer(self, data=None, instance=None):
        """Helper to get serializer with context"""
        mock_request = SimpleNamespace(user=self.user)
        context = {'request': mock_request, 'project': self.project}

        if data is None:
            return TodoListSerializer(instance=instance, context=context)

        return TodoListSerializer(data=data, instance=instance, context=context)

    def test_valid_list_data(self):
        """Test : serializer with valid data"""
        serializer = self.get_serializer(data={'name': 'Sprint 1'})

        self.assertTrue(serializer.is_valid())
        todo_list = serializer.save(project=self.project)
        self.assertEqual(todo_list.name, 'Sprint 1')
        self.assertEqual(todo_list.project, self.project)

    def test_name_is_trimmed(self):
        """Test : surrounding whitespace is stripped"""
        serializer = self.get_serializer(data={'name': '  Backlog  '})

        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['name'], 'Backlog')

    def test_empty_name_rejected(self):
        """Test : a whitespace-only name is refused"""
        serializer = self.get_serializer(data={'name': '   '})

        self.assertFalse(serializer.is_valid())
        self.assertIn('name', serializer.errors)

    def test_duplicate_name_rejected(self):
        """Test : the serializer reports a clash instead of hitting the database"""
        TodoList.objects.create(name='Backlog', project=self.project)
        serializer = self.get_serializer(data={'name': 'Backlog'})

        self.assertFalse(serializer.is_valid())
        self.assertIn('name', serializer.errors)

    def test_renaming_a_list_to_its_own_name_is_allowed(self):
        """Test : the uniqueness check ignores the instance being updated"""
        todo_list = TodoList.objects.create(name='Backlog', project=self.project)
        serializer = self.get_serializer(
            data={'name': 'Backlog'}, instance=todo_list
        )

        self.assertTrue(serializer.is_valid())

    def test_read_only_fields_are_ignored(self):
        """Test : ids and timestamps cannot be forced through the serializer"""
        serializer = self.get_serializer(
            data={
                'name': 'Sprint 1',
                'id': 666,
                'project_id': 666,
            }
        )

        self.assertTrue(serializer.is_valid())
        todo_list = serializer.save(project=self.project)
        self.assertNotEqual(todo_list.id, 666)
        self.assertEqual(todo_list.project, self.project)

    def test_todo_count_is_exposed(self):
        """Test : a list carries how many todos it holds"""
        todo_list = TodoList.objects.create(name='Sprint 1', project=self.project)
        TODO.objects.create(title='One', project=self.project, list=todo_list)
        TODO.objects.create(title='Two', project=self.project, list=todo_list)
        TODO.objects.create(title='Loose', project=self.project)

        serializer = self.get_serializer(instance=todo_list)

        self.assertEqual(serializer.data['todo_count'], 2)


class TODOSerializerListFieldTestCase(TestCase):
    """Test suite for the list field of TODOSerializer"""

    def setUp(self):
        """Set up test user, project and list"""
        self.user = User.objects.create_user(
            email='todolistfield@example.com',
            password='testpass123'
        )
        self.project = Project.objects.create(
            title='Todo List Field Project',
            user=self.user
        )
        self.todo_list = TodoList.objects.create(
            name='Sprint 1', project=self.project
        )

    def get_serializer(self, data=None, instance=None):
        """Helper to get serializer with context"""
        mock_request = SimpleNamespace(user=self.user)
        return TODOSerializer(
            data=data,
            instance=instance,
            context={'request': mock_request, 'project': self.project}
        )

    def test_list_defaults_to_none(self):
        """Test : a todo serialized without a list comes out unclassified"""
        serializer = self.get_serializer(data={'title': 'Loose end'})

        self.assertTrue(serializer.is_valid())
        todo = serializer.save(project=self.project)
        self.assertIsNone(todo.list)
        self.assertIsNone(serializer.data['list'])

    def test_list_is_writable(self):
        """Test : a todo can be filed through the serializer"""
        serializer = self.get_serializer(
            data={'title': 'Filed', 'list': str(self.todo_list.id)}
        )

        self.assertTrue(serializer.is_valid())
        todo = serializer.save(project=self.project)
        self.assertEqual(todo.list, self.todo_list)

    def test_list_can_be_cleared(self):
        """Test : a todo can be pulled back out of its list"""
        todo = TODO.objects.create(
            title='Filed', project=self.project, list=self.todo_list
        )
        serializer = self.get_serializer(
            data={'title': todo.title, 'list': None}, instance=todo
        )

        self.assertTrue(serializer.is_valid())
        updated = serializer.save()
        self.assertIsNone(updated.list)

    def test_list_of_another_project_rejected(self):
        """Test : a todo cannot be filed into another project's list"""
        other_project = Project.objects.create(
            title='Other Todo List Project', user=self.user
        )
        foreign_list = TodoList.objects.create(
            name='Elsewhere', project=other_project
        )
        serializer = self.get_serializer(
            data={'title': 'Filed', 'list': str(foreign_list.id)}
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('list', serializer.errors)

    def test_list_of_another_user_rejected(self):
        """Test : the list field only accepts lists the user owns"""
        other_user = User.objects.create_user(
            email='listintruder@example.com',
            password='testpass123'
        )
        other_project = Project.objects.create(
            title='Intruder Project', user=other_user
        )
        foreign_list = TodoList.objects.create(
            name='Theirs', project=other_project
        )
        serializer = self.get_serializer(
            data={'title': 'Filed', 'list': str(foreign_list.id)}
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('list', serializer.errors)
