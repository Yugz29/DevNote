from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from accounts.models import User
from workspace.models import Project, Note, Snippet, TODO


class SearchView(APITestCase):
    """Tests for the global search endpoint"""

    def setUp(self):
        """Create test user and authenticate"""
        # User 1
        self.user = User.objects.create_user(
            email='testuser@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Other User (for isolation test)
        self.other_user = User.objects.create_user(
            email='otheruser@example.com',
            password='otherpass123'
        )
        
        # Project for user 1
        self.project = Project.objects.create(
            user=self.user,
            title='Test Project'
        )

        # Test data
        self.note = Note.objects.create(
            project=self.project,
            title='Authentication Bug',
            content='Fix JWT validation'
        )

        self.snippet = Snippet.objects.create(
            project=self.project,
            title='Auth Middleware',
            language='python',
            content='def authenticate(): pass'
        )

        self.todo = TODO.objects.create(
            project=self.project,
            title='Fix auth system',
            description='Update authentication flow'
        )

        self.url = reverse('search')

    def test_search_all_types(self):
        """Test : global search across all types"""
        response = self.client.get(self.url, {'q': 'auth'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check all types are present
        self.assertIn('notes', response.data)
        self.assertIn('snippets', response.data)
        self.assertIn('todos', response.data)

        # Check results
        self.assertEqual(len(response.data['notes']), 1)
        self.assertEqual(len(response.data['snippets']), 1)
        self.assertEqual(len(response.data['todos']), 1)

        # Verify content
        self.assertEqual(response.data['notes'][0]['title'], 'Authentication Bug')
        self.assertEqual(response.data['snippets'][0]['title'], 'Auth Middleware')
        self.assertEqual(response.data['todos'][0]['title'], 'Fix auth system')

    def test_search_note_only(self):
        """Test : filtered search for notes only"""
        response = self.client.get(self.url, {'q': 'auth', 'type': 'notes'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn('notes', response.data)
        self.assertNotIn('snippets', response.data)
        self.assertNotIn('todos', response.data)

        self.assertEqual(len(response.data['notes']), 1)

    def test_search_snippets_only(self):
        """Test : filtered search for snippets only"""
        response = self.client.get(self.url, {'q': 'auth', 'type': 'snippets'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn('snippets', response.data)
        self.assertNotIn('notes', response.data)
        self.assertNotIn('todos', response.data)

        self.assertEqual(len(response.data['snippets']), 1)

    def test_search_todos_only(self):
        """Test : filtered search for todos only"""
        response = self.client.get(self.url, {'q': 'auth', 'type': 'todos'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn('todos', response.data)
        self.assertNotIn('snippets', response.data)
        self.assertNotIn('notes', response.data)

        self.assertEqual(len(response.data['todos']), 1)

    def test_search_missing_query(self):
        """Test : search without query parameter"""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(
            response.data['error'], 
            'Search query parameter "q" is required'
        )

    def test_search_invalid_type(self):
        """Test : search with invalid type parameter"""
        response = self.client.get(self.url, {'q': 'auth', 'type': 'invalid'})
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('notes, snippets, todos', response.data['error'])

    def test_search_user_isolation(self):
        """Test : Users can only search their own data"""
        other_project = Project.objects.create(
            user=self.other_user,
            title='Other Project'
        )
        
        Note.objects.create(
            project=other_project,
            title='Other auth note',
            content='Should not appear'
        )
        
        # Search as user 1
        response = self.client.get(self.url, {'q': 'auth'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should only find user 1's data
        self.assertEqual(len(response.data['notes']), 1)
        self.assertEqual(response.data['notes'][0]['title'], 'Authentication Bug')

    def test_search_no_results(self):
        """Test : search with no matching results"""
        response = self.client.get(self.url, {'q': 'nonexistent'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.assertEqual(len(response.data['notes']), 0)
        self.assertEqual(len(response.data['snippets']), 0)
        self.assertEqual(len(response.data['todos']), 0)
