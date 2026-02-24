from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from workspace.models import Project, TODO

User = get_user_model()


class TODOViewTest(APITestCase):
    """Test for Todo API views"""

    def setUp(self):
        """Create test users and projects"""
        self.user1 = User.objects.create_user(
            username='dev1',
            email='dev1@test.com',
            password='testpass123'
        )
        self.project1 = Project.objects.create(
            title='Project 1',
            user=self.user1
        )

        self.todo1 = TODO.objects.create(
            title='Test Todo 1',
            description='Test D Todo 1',
            project=self.project1
        )

        self.user2 = User.objects.create_user(
            username='dev2',
            email='dev2@test.com',
            password='testpass123'
        )
        self.project2 = Project.objects.create(
            title='Project 2',
            user=self.user2
        )

        self.todo2 = TODO.objects.create(
            title='Test Todo 2',
            description='Test D Todo 2',
            project=self.project2
        )

    def test_list_todos_authenticated(self):
        """Test : authenticated user can list their todos"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/todos/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and 'results' in response.data:
            todos = response.data['results']
        else:
            todos = response.data

        self.assertEqual(len(todos), 1)
        self.assertEqual(todos[0]['title'], 'Test Todo 1')
        self.assertEqual(todos[0]['description'], 'Test D Todo 1')

    def test_list_todos_unauthenticated(self):
        """Test : Unauthenticated request to list todos returns 401"""
        response = self.client.get('/api/todos/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_todos_nested(self):
        """Test : List todos via nested route /api/projects/{id}/todos"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f'/api/projects/{self.project1.id}/todos/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and 'results' in response.data:
            todos = response.data['results']
        else:
            todos = response.data

        self.assertEqual(len(todos), 1)
        self.assertEqual(todos[0]['title'], 'Test Todo 1')

    def test_create_todo_nested(self):
        """Test : Create todo via nested route POST"""
        self.client.force_authenticate(user=self.user1)

        data = {
            'title': 'New Todo List',
            'description': 'New D Todo List'
        }

        response = self.client.post(
            f'/api/projects/{self.project1.id}/todos/',
            data,
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'New Todo List')
        self.assertEqual(response.data['description'], 'New D Todo List')
        self.assertEqual(response.data['project_id'], str(self.project1.id))
        self.assertEqual(TODO.objects.count(), 3)

    def test_create_todo_flat_route_not_supported(self):
        """Test : POST on flat route /api/todos/ is not supported (no project context)"""
        self.client.force_authenticate(user=self.user1)

        data = {
            'title': 'Flat Route Todo',
            'description': 'No project context',
        }

        response = self.client.post('/api/todos/', data, format='json')

        # Flat route requires project_pk from URL — without it, access is denied
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_todo(self):
        """Test : GET detail of a todo"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f'/api/todos/{self.todo1.id}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], str(self.todo1.id))
        self.assertEqual(response.data['title'], 'Test Todo 1')
        self.assertEqual(response.data['description'], 'Test D Todo 1')
        self.assertEqual(response.data['project_id'], str(self.project1.id))
        self.assertNotIn('project', response.data)

    def test_update_todo(self):
        """Test : PATCH update a todo"""
        self.client.force_authenticate(user=self.user1)

        data = {
            'title': 'Updated Todo',
            'description': 'Updated Description Todo'
        }

        response = self.client.patch(
            f'/api/todos/{self.todo1.id}/',
            data,
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'Updated Todo')
        self.assertEqual(response.data['description'], 'Updated Description Todo')
        self.todo1.refresh_from_db()
        self.assertEqual(self.todo1.title, 'Updated Todo')
        self.assertEqual(self.todo1.description, 'Updated Description Todo')

    def test_delete_todo(self):
        """Test : DELETE remove a todo"""
        self.client.force_authenticate(user=self.user1)

        todo_id = self.todo1.id
        response = self.client.delete(f'/api/todos/{todo_id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(TODO.objects.filter(id=todo_id).exists())

    def test_user_isolation(self):
        """Test : User cannot access other user's TODOs"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.get(f'/api/todos/{self.todo2.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_user_todo(self):
        """Test : User cannot update other user's TODOs"""
        self.client.force_authenticate(user=self.user1)

        data = {'title': 'Hacked TODO'}
        response = self.client.patch(
            f'/api/todos/{self.todo2.id}/',
            data,
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_other_user_todo(self):
        """Test : User cannot delete other user's TODOs"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.delete(f'/api/todos/{self.todo2.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(TODO.objects.filter(id=self.todo2.id).exists())

    def test_filter_by_status(self):
        """Test : Filter TODOs by status"""
        self.client.force_authenticate(user=self.user1)

        TODO.objects.create(title='Done TODO', project=self.project1, status='done')
        TODO.objects.create(title='In Progress TODO', project=self.project1, status='in_progress')

        response = self.client.get('/api/todos/?status=done')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and 'results' in response.data:
            todos = response.data['results']
        else:
            todos = response.data

        self.assertEqual(len(todos), 1)
        self.assertEqual(todos[0]['status'], 'done')

    def test_filter_by_priority(self):
        """Test : Filter TODOs by priority"""
        self.client.force_authenticate(user=self.user1)

        TODO.objects.create(title='High Priority', project=self.project1, priority='high')
        TODO.objects.create(title='Low Priority', project=self.project1, priority='low')

        response = self.client.get('/api/todos/?priority=high')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and 'results' in response.data:
            todos = response.data['results']
        else:
            todos = response.data

        self.assertEqual(len(todos), 1)
        self.assertEqual(todos[0]['priority'], 'high')

    def test_create_todo_missing_title(self):
        """Test : Cannot create Todo without title"""
        self.client.force_authenticate(user=self.user1)

        data = {'description': 'No title'}

        response = self.client.post(
            f'/api/projects/{self.project1.id}/todos/',
            data,
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('title', response.data)

    def test_create_todo_invalid_status(self):
        """Test : Cannot create Todo with invalid status"""
        self.client.force_authenticate(user=self.user1)

        data = {
            'title': 'Invalid Status',
            'status': 'invalid_status'
        }

        response = self.client.post(
            f'/api/projects/{self.project1.id}/todos/',
            data,
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data)

    def test_create_todo_with_invalid_priority(self):
        """Test : Cannot create Todo with invalid priority"""
        self.client.force_authenticate(user=self.user1)

        data = {
            'title': 'Invalid Priority',
            'priority': 'invalid_priority'
        }

        response = self.client.post(
            f'/api/projects/{self.project1.id}/todos/',
            data,
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('priority', response.data)
