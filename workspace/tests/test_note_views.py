from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from workspace.models import Note, Project

User = get_user_model()

class NoteViewTest(APITestCase):
    """Tests for Note API views"""

    def setUp(self):
        """Helper to create a test user, project, and authenticate"""
        self.user = User.objects.create_user(
            username='notetestuser',
            email='note@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title='Note Test Project',
            description='A project for note testing.',
            user=self.user
        )
        
        self.note = Note.objects.create(
            title='Test Note',
            content='This is a test note.',
            project=self.project
        )

    def test_list_notes_authenticated(self):
        """Test listing notes when authenticated"""
        response = self.client.get(f'/api/projects/{self.project.id}/notes/')

        # Status
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Automatic pagination/non-pagination management
        if isinstance(response.data, dict) and 'results' in response.data:
            notes = response.data['results']
            # Test pagination metadata
            self.assertEqual(response.data['count'], 1)
            self.assertIsNone(response.data['next'])
            self.assertIsNone(response.data['previous'])
        else:
            notes = response.data

        # Number of notes
        self.assertEqual(len(notes), 1)

        # Content of the note
        self.assertEqual(notes[0]['title'], self.note.title)
        self.assertEqual(notes[0]['content'], self.note.content)
        
        # Check UUID is present
        self.assertIn('id', notes[0])

    def test_list_notes_unauthenticated(self):
        """Test listing notes without authentication returns 401"""
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/projects/{self.project.id}/notes/')

        # Always 401 (because IsAuthenticate BEFORE get_queryset())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_note(self):
        """Test creating a new note"""
        data = {
            'title': 'New Note',
            'content': 'A new test Note'
        }
        response = self.client.post(
            f'/api/projects/{self.project.id}/notes/',
            data,
            format='json'
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'New Note')
        self.assertEqual(response.data['content'], 'A new test Note')
        self.assertEqual(response.data['project_id'], str(self.project.id))

        self.assertTrue(
            Note.objects.filter(
                title='New Note',
                project=self.project
            ).exists()
        )
    
    def test_create_note_unauthenticated(self):
        """Test creating note when unauthenticated"""
        self.client.force_authenticate(user=None)
        data = {
            'title': 'Unauthorized Note',
            'content': 'Unauthorized Note content'
        }
        response = self.client.post(
            f'/api/projects/{self.project.id}/notes/',
            data,
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Note.objects.count(), 1)

    def test_retrieve_note(self):
        """Test retrieving a specific note"""
        response = self.client.get(f'/api/projects/{self.project.id}/notes/{self.note.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], self.note.title)
        self.assertEqual(response.data['content'], self.note.content)

    def test_update_note(self):
        """Test updating a note"""
        data = {
            'title': 'Updated title Note',
            'content': 'Updated content Note'
        }
        response = self.client.patch(
            f'/api/projects/{self.project.id}/notes/{self.note.id}/',
            data,
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Updated title Note')
        self.assertEqual(response.data['content'], 'Updated content Note')
        
        self.note.refresh_from_db()
        self.assertEqual(self.note.title, 'Updated title Note')
        self.assertEqual(self.note.content, 'Updated content Note')


    def test_delete_note(self):
        """Test deleting a note"""
        response = self.client.delete(
            f'/api/projects/{self.project.id}/notes/{self.note.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Note.objects.count(), 0)

    def test_user_isolation(self):
        """Test that users cannot acces each other's notes"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@test.com',
            password='OtherPass123!'
        )
        other_project = Project.objects.create(
            title='Other Project',
            description='A project for the other user',
            user=other_user
        )
        other_note = Note.objects.create(
            title='Other Note',
            content='A Note for the other project',
            project=other_project
        )

        response = self.client.get(
            f'/api/projects/{other_project.id}/notes/{other_note.id}/'
            )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = self.client.get(f'/api/projects/{self.project.id}/notes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        if isinstance(response.data, dict) and 'results' in response.data:
            notes = response.data['results']
        else:
            notes = response.data

        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]['title'], self.note.title)

        data = {
            'title': 'Hack attempt',
            'content': 'Trying to create in other project'
        }
        response = self.client.post(
            f'/api/projects/{other_project.id}/notes/',
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_project_isolation(self):
        """Test that notes are strictly isolated by project"""

        project_b = Project.objects.create(
            title='Project B',
            description='Another project for same user',
            user=self.user
        )

        note_b = Note.objects.create(
            title='Note in Project B',
            content='This belongs to Project B',
            project=project_b
        )

        response = self.client.get(f'/api/projects/{self.project.id}/notes/')
        if isinstance(response.data, dict) and 'results' in response.data:
            notes = response.data['results']
        else:
            notes = response.data

        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]['title'], 'Test Note')

        response = self.client.get(f'/api/projects/{project_b.id}/notes/')
        if isinstance(response.data, dict) and 'results' in response.data:
            notes = response.data['results']
        else:
            notes = response.data

        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]['title'], 'Note in Project B')
