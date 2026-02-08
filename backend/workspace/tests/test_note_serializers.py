from django.test import TestCase
from django.contrib.auth import get_user_model
from workspace.models import Project, Note
from workspace.serializers import NoteSerializer
from types import SimpleNamespace

User = get_user_model()


class NoteSerializerTest(TestCase):
    def setUp(self):
        """Set up a user and a project for testing"""
        self.user = User.objects.create_user(
            username='usertest',
            email='user@test.com',
            password='TestPass123!'
        )
        self.project = Project.objects.create(
            title='Test Project',
            user=self.user
        )

    def get_serializer(self, data=None, instance=None):
        """Helper to get serializer with context"""
        mock_request = SimpleNamespace(user=self.user)
        return NoteSerializer(
            data=data,
            instance=instance,
            context={'request': mock_request}
        )
    
    def test_valid_note_data(self):
        """Test serializer with valid data"""
        data = {
            'title': 'Test Note',
            'content': 'This is a test note.',
            'project': self.project.id
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        note = serializer.save()
        self.assertEqual(note.title, data['title'])
        self.assertEqual(note.content, data['content'])
        self.assertEqual(note.project, self.project)

    def test_missing_title(self):
        """Test that title is required"""
        data = {
            'content': 'This is a test note.',
            'project': self.project.id
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_title_too_long(self):
        """Test that title exceeding max length is invalid"""
        data = {
            'title': 'A' * 256,
            'content': 'This is a test note.',
            'project': self.project.id
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_empty_content_allowed(self):
        """Test that empty content is valid"""
        data = {
            'title': 'Test Note',
            'content': '',
            'project': self.project.id
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        note = serializer.save()
        self.assertEqual(note.content, '')
    
    def test_title_trimmed(self):
        """Test that title is trimmed of whitespace"""
        data = {
            'title': '   Trimmed Note Title   ',
            'content': 'Content here.',
            'project': self.project.id
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        note = serializer.save()
        self.assertEqual(note.title, 'Trimmed Note Title')

    def test_project_isolation(self):
        """Test that users cannot create notes in other users projects"""
        # Créer un AUTRE user
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@test.com',
            password='OtherPass123!'
        )
        
        # 2. Créer un projet de cet AUTRE user
        other_project = Project.objects.create(
            title='Other User Project',
            user=other_user  # ← Projet d'un autre !
        )
        
        # 3. self.user essaie de créer une note dans other_project
        data = {
            'title': 'Hacker Note',
            'content': 'Trying to hack...',
            'project': other_project.id  # ← Projet qui n'appartient PAS à self.user
        }
        
        # 4. Le serializer utilise self.user (via get_serializer)
        serializer = self.get_serializer(data=data)
        
        # 5. Vérifier que c'est INVALIDE
        self.assertFalse(serializer.is_valid())  # ← DOIT échouer
        self.assertIn('project', serializer.errors)  # ← Erreur sur 'project'
        
        # 6. Vérifier le message d'erreur
        self.assertIn(
            'You do not have permission',
            str(serializer.errors['project'][0])
        )

    def test_title_spaces_only(self):
        """Test that title with only spaces is invalid"""
        data = {
            'title': '     ',
            'content': 'Content here.',
            'project': self.project.id
        }
        serializer = self.get_serializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('title', serializer.errors)

    def test_read_only_fields(self):
        """Test that read-only fields cannot be set"""
        fake_date = '2024-01-01T00:00:00Z'
        data = {
            'title': 'Test Note',
            'content': 'This is a test note.',
            'project': self.project.id,
            'id': 666,
            'created_at': fake_date,
            'updated_at': fake_date
        }
        serializer = self.get_serializer(data=data)
        self.assertTrue(serializer.is_valid())
        note = serializer.save()
        self.assertNotEqual(note.id, 666)
        self.assertNotEqual(str(note.created_at), fake_date)
        self.assertNotEqual(str(note.updated_at), fake_date)
