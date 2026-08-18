from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from workspace.models import Folder, Note, Project

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

    def test_duplicate_note(self):
        """Test duplicating a note copies its content into the same project"""
        response = self.client.post(
            f'/api/notes/{self.note.id}/duplicate/',
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'Test Note (copy)')
        self.assertEqual(response.data['content'], self.note.content)
        self.assertEqual(response.data['project_id'], str(self.project.id))
        self.assertIsNone(response.data['folder'])
        self.assertNotEqual(response.data['id'], str(self.note.id))

        self.assertEqual(Note.objects.count(), 2)

        self.note.refresh_from_db()
        self.assertEqual(self.note.title, 'Test Note')

    def test_duplicate_note_nested_route(self):
        """Test duplicating a note through the project nested route"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/notes/{self.note.id}/duplicate/',
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'Test Note (copy)')
        self.assertEqual(Note.objects.count(), 2)

    def test_duplicate_note_keeps_folder(self):
        """Test the copy lands in the folder holding the original note"""
        folder = Folder.objects.create(name='Guides', project=self.project)
        note = Note.objects.create(
            title='Filed Note',
            content='Filed content',
            project=self.project,
            folder=folder
        )

        response = self.client.post(
            f'/api/notes/{note.id}/duplicate/',
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['folder'], folder.id)

        copy = Note.objects.get(id=response.data['id'])
        self.assertEqual(copy.folder, folder)
        self.assertEqual(copy.content, note.content)

    def test_duplicate_note_numbers_further_copies(self):
        """Test duplicating twice in a row does not repeat the same title"""
        first = self.client.post(
            f'/api/notes/{self.note.id}/duplicate/',
            format='json'
        )
        second = self.client.post(
            f'/api/notes/{self.note.id}/duplicate/',
            format='json'
        )

        self.assertEqual(first.data['title'], 'Test Note (copy)')
        self.assertEqual(second.data['title'], 'Test Note (copy 2)')
        self.assertEqual(Note.objects.count(), 3)

    def test_duplicate_note_truncates_long_title(self):
        """Test the copy title stays within the title max length"""
        max_length = Note._meta.get_field('title').max_length
        note = Note.objects.create(
            title='N' * max_length,
            content='Long title content',
            project=self.project
        )

        response = self.client.post(
            f'/api/notes/{note.id}/duplicate/',
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['title']), max_length)
        self.assertTrue(response.data['title'].endswith(' (copy)'))

    def test_duplicate_note_unauthenticated(self):
        """Test duplicating a note without authentication returns 401"""
        self.client.force_authenticate(user=None)
        response = self.client.post(
            f'/api/notes/{self.note.id}/duplicate/',
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Note.objects.count(), 1)

    def test_duplicate_note_user_isolation(self):
        """Test that users cannot duplicate each other's notes"""
        other_user = User.objects.create_user(
            username='duplicateotheruser',
            email='duplicate-other@test.com',
            password='OtherPass123!'
        )
        other_project = Project.objects.create(
            title='Other Duplicate Project',
            description='A project for the other user',
            user=other_user
        )
        other_note = Note.objects.create(
            title='Other Note',
            content='A Note for the other project',
            project=other_project
        )

        response = self.client.post(
            f'/api/notes/{other_note.id}/duplicate/',
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Note.objects.filter(project=other_project).count(), 1)

    def test_note_is_unpinned_on_create(self):
        """Test that a note created through the API starts unpinned"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/notes/',
            {'title': 'Fresh Note', 'content': 'Fresh content'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['is_pinned'])

    def test_pin_note_through_patch(self):
        """Test that the generic note update toggles the pin"""
        response = self.client.patch(
            f'/api/notes/{self.note.id}/',
            {'is_pinned': True},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_pinned'])

        self.note.refresh_from_db()
        self.assertTrue(self.note.is_pinned)

        response = self.client.patch(
            f'/api/notes/{self.note.id}/',
            {'is_pinned': False},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_pinned'])

        self.note.refresh_from_db()
        self.assertFalse(self.note.is_pinned)

    def test_pinning_leaves_the_note_in_place(self):
        """Test that pinning changes nothing but the flag"""
        folder = Folder.objects.create(name='Filed', project=self.project)
        note = Note.objects.create(
            title='Filed Note',
            content='Filed content',
            project=self.project,
            folder=folder
        )

        response = self.client.patch(
            f'/api/notes/{note.id}/',
            {'is_pinned': True},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        note.refresh_from_db()
        self.assertTrue(note.is_pinned)
        self.assertEqual(note.folder, folder)
        self.assertEqual(note.title, 'Filed Note')
        self.assertEqual(note.content, 'Filed content')

    def test_retrieve_note_exposes_is_pinned(self):
        """Test that the pin state is readable on a single note"""
        self.note.is_pinned = True
        self.note.save()

        response = self.client.get(
            f'/api/projects/{self.project.id}/notes/{self.note.id}/'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_pinned'])

    def test_pinning_a_foreign_note_denied(self):
        """Test that users cannot pin each other's notes"""
        other_user = User.objects.create_user(
            username='pinotheruser',
            email='pin-other@test.com',
            password='OtherPass123!'
        )
        other_project = Project.objects.create(
            title='Other Pin Project',
            description='A project for the other user',
            user=other_user
        )
        other_note = Note.objects.create(
            title='Other Note',
            content='A Note for the other project',
            project=other_project
        )

        response = self.client.patch(
            f'/api/notes/{other_note.id}/',
            {'is_pinned': True},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        other_note.refresh_from_db()
        self.assertFalse(other_note.is_pinned)

    def test_duplicate_note_leaves_the_copy_unpinned(self):
        """Test that duplicating a pinned note does not pin the copy"""
        self.note.is_pinned = True
        self.note.save()

        response = self.client.post(
            f'/api/notes/{self.note.id}/duplicate/',
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['is_pinned'])

        self.note.refresh_from_db()
        self.assertTrue(self.note.is_pinned)


class ProjectPinnedViewTest(APITestCase):
    """Tests for the project-wide pinned notes endpoint"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='pinnedviewuser',
            email='pinnedview@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title='Pinned View Project',
            user=self.user
        )
        self.folder = Folder.objects.create(
            name='Archives', project=self.project
        )
        self.nested = Folder.objects.create(
            name='Deep', project=self.project, parent=self.folder
        )

    def test_pinned_gathers_notes_across_the_folder_tree(self):
        """Test that the endpoint reaches pinned notes at any depth"""
        root_pinned = Note.objects.create(
            title='Root pinned', project=self.project, is_pinned=True
        )
        deep_pinned = Note.objects.create(
            title='Deep pinned',
            project=self.project,
            folder=self.nested,
            is_pinned=True
        )
        Note.objects.create(title='Root plain', project=self.project)
        Note.objects.create(
            title='Filed plain', project=self.project, folder=self.folder
        )

        response = self.client.get(f'/api/projects/{self.project.id}/pinned/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

        ids = {entry['id'] for entry in response.data['results']}
        self.assertEqual(ids, {str(root_pinned.id), str(deep_pinned.id)})

    def test_pinned_entries_use_the_gallery_card_shape(self):
        """Test that pinned entries render like any other gallery note"""
        note = Note.objects.create(
            title='Pinned note',
            content='# Heading\n\nSome body text.',
            project=self.project,
            folder=self.folder,
            is_pinned=True
        )

        response = self.client.get(f'/api/projects/{self.project.id}/pinned/')
        entry = response.data['results'][0]

        self.assertEqual(
            set(entry.keys()),
            {
                'type', 'id', 'title', 'preview', 'project_id',
                'folder', 'is_pinned', 'created_at', 'updated_at',
            }
        )
        self.assertEqual(entry['type'], 'note')
        self.assertTrue(entry['is_pinned'])
        self.assertEqual(entry['folder'], self.folder.id)
        self.assertEqual(entry['preview'], 'Heading Some body text.')
        self.assertEqual(entry['title'], note.title)

    def test_pinned_is_empty_when_nothing_is_pinned(self):
        """Test that a project without pinned notes returns an empty stream"""
        Note.objects.create(title='Root plain', project=self.project)

        response = self.client.get(f'/api/projects/{self.project.id}/pinned/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])

    def test_pinned_is_scoped_to_the_project(self):
        """Test that pinned notes of another project are not listed"""
        other_project = Project.objects.create(
            title='Other Pinned Project', user=self.user
        )
        Note.objects.create(
            title='Elsewhere', project=other_project, is_pinned=True
        )
        mine = Note.objects.create(
            title='Mine', project=self.project, is_pinned=True
        )

        response = self.client.get(f'/api/projects/{self.project.id}/pinned/')

        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], str(mine.id))

    def test_pinned_of_foreign_project_denied(self):
        """Test that users cannot read another user's pinned notes"""
        other_user = User.objects.create_user(
            username='pinnedforeign',
            email='pinnedforeign@test.com',
            password='OtherPass123!'
        )
        foreign_project = Project.objects.create(
            title='Foreign Project', user=other_user
        )
        Note.objects.create(
            title='Foreign pinned', project=foreign_project, is_pinned=True
        )

        response = self.client.get(f'/api/projects/{foreign_project.id}/pinned/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_pinned_unauthenticated(self):
        """Test that the pinned endpoint requires authentication"""
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/projects/{self.project.id}/pinned/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_pinned_is_paginated(self):
        """Test that the pinned stream follows the pagination shape"""
        for index in range(25):
            Note.objects.create(
                title=f'Pinned {index}', project=self.project, is_pinned=True
            )

        response = self.client.get(f'/api/projects/{self.project.id}/pinned/')

        self.assertEqual(
            set(response.data.keys()),
            {'count', 'next', 'previous', 'results'}
        )
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 20)
        self.assertIsNotNone(response.data['next'])
