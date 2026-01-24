from django.test import TestCase
from django.contrib.auth import get_user_model
from workspace.models import Note, Project
from uuid import UUID
from django.core.exceptions import ValidationError

User = get_user_model()

class NoteModelTest(TestCase):
    """Tests for the Note model"""

    def setUp(self):
        """Preparation: create a test user and a project"""
        self.user = User.objects.create_user(
            username='notetestuser',
            email='user@test.com',
            password='TestPass123!'
        )
        self.project = Project.objects.create(
            title='Note Test Project',
            description='A project for note testing.',
            user=self.user
        )
    def test_create_note(self):
        """Test creating a note"""
        note = Note.objects.create(
            title='Test Note',
            content='',
            project=self.project
        )

        self.assertEqual(note.title, 'Test Note')
        self.assertEqual(note.project, self.project)
        self.assertIsNotNone(note.created_at)
        self.assertIsInstance(note.id, UUID)
        self.assertEqual(note.content, '')

    def test_delete_note_cascade(self):
        """Test that deleting a project cascades to delete its notes"""
        note = Note.objects.create(
            title='Note to be deleted',
            content='This note will be deleted when the project is deleted.',
            project=self.project
        )

        self.assertEqual(Note.objects.count(), 1)
        self.project.delete()
        self.assertEqual(Note.objects.count(), 0)

    def test_same_note_title(self):
        """Test that notes with the same title can exist under the same project"""
        note1 = Note.objects.create(
            title='First Note',
            project=self.project
        )
        note2 = Note.objects.create(
            title='First Note',
            project=self.project
        )

        notes = self.project.notes.all()
        self.assertEqual(notes.count(), 2)
        self.assertIn(note1, notes)
        self.assertIn(note2, notes)
        self.assertNotEqual(note1.id, note2.id)

    def test_empty_note_title(self):
        """Test that creating a note with an empty title raises an error"""
        note = Note(
            title='   ',
            project=self.project
        )
        with self.assertRaises(ValidationError):
            note.full_clean()

    def test_str_method(self):
        """Test the __str__ method of the Note model"""
        note = Note.objects.create(
            title='String Method Note',
            project=self.project
        )
        self.assertEqual(str(note), 'String Method Note')
