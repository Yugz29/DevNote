from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from workspace.models import Project, TODO, TodoList

User = get_user_model()


class TodoListViewTest(APITestCase):
    """Tests for the TodoList API endpoints"""

    def setUp(self):
        """Create test users, projects and lists"""
        self.user = User.objects.create_user(
            username='listdev',
            email='listdev@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title='List View Project',
            user=self.user
        )
        self.todo_list = TodoList.objects.create(
            name='Sprint 1', project=self.project
        )

        self.other_user = User.objects.create_user(
            username='listintruder',
            email='listintruder@test.com',
            password='OtherPass123!'
        )
        self.other_project = Project.objects.create(
            title='Foreign List Project',
            user=self.other_user
        )
        self.foreign_list = TodoList.objects.create(
            name='Theirs', project=self.other_project
        )

    def test_list_lists_of_a_project(self):
        """Test : the nested route returns the lists of that project"""
        TodoList.objects.create(name='Backlog', project=self.project)

        response = self.client.get(
            f'/api/projects/{self.project.id}/todo-lists/'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        names = [entry['name'] for entry in response.data['results']]
        self.assertEqual(names, ['Backlog', 'Sprint 1'])

    def test_list_carries_its_todo_count(self):
        """Test : each list reports how many todos it holds"""
        TODO.objects.create(title='One', project=self.project, list=self.todo_list)
        TODO.objects.create(title='Two', project=self.project, list=self.todo_list)
        TODO.objects.create(title='Loose', project=self.project)

        response = self.client.get(
            f'/api/projects/{self.project.id}/todo-lists/'
        )

        self.assertEqual(response.data['results'][0]['todo_count'], 2)

    def test_list_shape(self):
        """Test : a list is served with the expected fields"""
        response = self.client.get(
            f'/api/projects/{self.project.id}/todo-lists/'
        )
        entry = response.data['results'][0]

        self.assertEqual(
            set(entry.keys()),
            {
                'id', 'name', 'project_id', 'todo_count',
                'created_at', 'updated_at',
            }
        )

    def test_create_list(self):
        """Test : a list is created under its project"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/todo-lists/',
            {'name': 'Backlog'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Backlog')
        self.assertEqual(response.data['project_id'], str(self.project.id))
        self.assertEqual(TodoList.objects.filter(project=self.project).count(), 2)

    def test_create_list_with_empty_name_rejected(self):
        """Test : a list needs a name"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/todo-lists/',
            {'name': '   '},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_create_duplicate_name_rejected(self):
        """Test : two lists of a project cannot share a name"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/todo-lists/',
            {'name': 'Sprint 1'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_create_list_in_a_foreign_project_denied(self):
        """Test : users cannot add lists to someone else's project"""
        response = self.client.post(
            f'/api/projects/{self.other_project.id}/todo-lists/',
            {'name': 'Intrusion'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            TodoList.objects.filter(project=self.other_project).count(), 1
        )

    def test_rename_list(self):
        """Test : a list can be renamed"""
        response = self.client.patch(
            f'/api/todo-lists/{self.todo_list.id}/',
            {'name': 'Sprint 2'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Sprint 2')

        self.todo_list.refresh_from_db()
        self.assertEqual(self.todo_list.name, 'Sprint 2')

    def test_rename_to_an_existing_name_rejected(self):
        """Test : renaming cannot create a duplicate"""
        TodoList.objects.create(name='Backlog', project=self.project)

        response = self.client.patch(
            f'/api/todo-lists/{self.todo_list.id}/',
            {'name': 'Backlog'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_rename_a_foreign_list_denied(self):
        """Test : users cannot rename each other's lists"""
        response = self.client.patch(
            f'/api/todo-lists/{self.foreign_list.id}/',
            {'name': 'Mine now'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.foreign_list.refresh_from_db()
        self.assertEqual(self.foreign_list.name, 'Theirs')

    def test_delete_empty_list(self):
        """Test : an empty list is deleted outright"""
        response = self.client.delete(f'/api/todo-lists/{self.todo_list.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(TodoList.objects.filter(id=self.todo_list.id).count(), 0)

    def test_delete_list_unclassifies_its_todos(self):
        """Test : deleting a list keeps its todos, without a list"""
        filed = TODO.objects.create(
            title='Filed', project=self.project, list=self.todo_list
        )
        loose = TODO.objects.create(title='Loose', project=self.project)

        response = self.client.delete(f'/api/todo-lists/{self.todo_list.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(TODO.objects.count(), 2)

        filed.refresh_from_db()
        loose.refresh_from_db()
        self.assertIsNone(filed.list)
        self.assertIsNone(loose.list)

    def test_delete_a_foreign_list_denied(self):
        """Test : users cannot delete each other's lists"""
        response = self.client.delete(f'/api/todo-lists/{self.foreign_list.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(TodoList.objects.filter(id=self.foreign_list.id).count(), 1)

    def test_lists_of_a_foreign_project_denied(self):
        """Test : the nested listing refuses another user's project"""
        response = self.client.get(
            f'/api/projects/{self.other_project.id}/todo-lists/'
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_flat_listing_is_scoped_to_the_user(self):
        """Test : the unnested route never leaks another user's lists"""
        response = self.client.get('/api/todo-lists/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {entry['id'] for entry in response.data['results']}
        self.assertEqual(ids, {str(self.todo_list.id)})

    def test_lists_require_authentication(self):
        """Test : the endpoint is closed to anonymous users"""
        self.client.force_authenticate(user=None)

        response = self.client.get(
            f'/api/projects/{self.project.id}/todo-lists/'
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TodoListFilterViewTest(APITestCase):
    """Tests for the ?list= filter on the todo endpoints"""

    def setUp(self):
        """Create a project holding one list and a loose todo"""
        self.user = User.objects.create_user(
            username='filterdev',
            email='filterdev@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title='Filter Project', user=self.user
        )
        self.sprint = TodoList.objects.create(name='Sprint 1', project=self.project)
        self.backlog = TodoList.objects.create(name='Backlog', project=self.project)

        self.filed = TODO.objects.create(
            title='Filed', project=self.project, list=self.sprint
        )
        self.other_filed = TODO.objects.create(
            title='Other filed', project=self.project, list=self.backlog
        )
        self.loose = TODO.objects.create(title='Loose', project=self.project)

    def test_unfiltered_listing_returns_every_todo(self):
        """Test : the global view aggregates all the lists plus the loose todos"""
        response = self.client.get(f'/api/projects/{self.project.id}/todos/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {entry['id'] for entry in response.data['results']}
        self.assertEqual(
            ids,
            {str(self.filed.id), str(self.other_filed.id), str(self.loose.id)}
        )

    def test_filter_by_list(self):
        """Test : ?list=<uuid> narrows to that list"""
        response = self.client.get(
            f'/api/projects/{self.project.id}/todos/?list={self.sprint.id}'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {entry['id'] for entry in response.data['results']}
        self.assertEqual(ids, {str(self.filed.id)})

    def test_filter_by_null_list(self):
        """Test : ?list=null returns the unclassified todos"""
        response = self.client.get(
            f'/api/projects/{self.project.id}/todos/?list=null'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {entry['id'] for entry in response.data['results']}
        self.assertEqual(ids, {str(self.loose.id)})

    def test_filter_by_invalid_list_id(self):
        """Test : a malformed list id is a bad request, not a crash"""
        response = self.client.get(
            f'/api/projects/{self.project.id}/todos/?list=not-a-uuid'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filter_combines_with_status(self):
        """Test : the list filter stacks with the existing ones"""
        TODO.objects.create(
            title='Filed and done',
            project=self.project,
            list=self.sprint,
            status='done'
        )

        response = self.client.get(
            f'/api/projects/{self.project.id}/todos/'
            f'?list={self.sprint.id}&status=done'
        )

        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['title'], 'Filed and done')

    def test_todo_is_unclassified_on_create(self):
        """Test : a todo created without a list comes out unclassified"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/todos/',
            {'title': 'Fresh'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['list'])

    def test_create_todo_in_a_list(self):
        """Test : a todo can be filed at creation"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/todos/',
            {'title': 'Fresh', 'list': str(self.sprint.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['list'], self.sprint.id)

    def test_move_todo_between_lists_through_patch(self):
        """Test : the generic update moves a todo from one list to another"""
        response = self.client.patch(
            f'/api/todos/{self.filed.id}/',
            {'list': str(self.backlog.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.filed.refresh_from_db()
        self.assertEqual(self.filed.list, self.backlog)

    def test_unclassify_todo_through_patch(self):
        """Test : a todo can be pulled out of its list"""
        response = self.client.patch(
            f'/api/todos/{self.filed.id}/',
            {'list': None},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['list'])

        self.filed.refresh_from_db()
        self.assertIsNone(self.filed.list)

    def test_todos_of_a_foreign_project_denied(self):
        """Test : the todo listing refuses another user's project"""
        other_user = User.objects.create_user(
            username='todoscopeintruder',
            email='todoscopeintruder@test.com',
            password='OtherPass123!'
        )
        other_project = Project.objects.create(
            title='Foreign Scope Project', user=other_user
        )
        TODO.objects.create(title='Theirs', project=other_project)

        response = self.client.get(f'/api/projects/{other_project.id}/todos/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_filing_into_a_foreign_list_denied(self):
        """Test : a todo cannot be filed into another user's list"""
        other_user = User.objects.create_user(
            username='filterintruder',
            email='filterintruder@test.com',
            password='OtherPass123!'
        )
        other_project = Project.objects.create(
            title='Foreign Filter Project', user=other_user
        )
        foreign_list = TodoList.objects.create(
            name='Theirs', project=other_project
        )

        response = self.client.patch(
            f'/api/todos/{self.filed.id}/',
            {'list': str(foreign_list.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.filed.refresh_from_db()
        self.assertEqual(self.filed.list, self.sprint)
