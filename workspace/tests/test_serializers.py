from django.test import TestCase
from django.contrib.auth import get_user_model
from workspace.serializers import ProjectSerializer

User = get_user_model()

class ProjectSerializerTest(TestCase):
    """Tests for ProjectSerializer"""
    
    def setUp(self):
        """Helper to create a test user"""
        self.user = User.objects.create_user(
            username='usertest',
            email='user@test.com',
            password='TestPass123!'
        )

    def get_serializer(self, data=None, instance=None):
        """Helper to get serializer with context"""
        context = {'request': type('obj', (object,), {'user': self.user})()}
        return ProjectSerializer(
            data=data,
            instance=instance,
            context=context
        )

    def test_valid_project_data(self):
        """Test serializer with valid data"""
        data = {
            'name': 'My test Project',
            'description': 'A description for my test project.'
        }
        serializer = self.get_serializer(data=data)

        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['name'], data['name'].strip())
        self.assertEqual(serializer.validated_data['description'], data['description'])

    def test_missing_name(self):
        """Test that name is required"""
        data = {
            'description': 'A description for my test project.'
        }
        serializer = self.get_serializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn('name', serializer.errors)

    def test_name_too_long(self):
        """Test that name exceeding max length is invalid"""
        data = {
            'name': 'A' * 256,
            'description': 'A description for my test project.'
        }
        serializer = self.get_serializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn('name', serializer.errors)
    
    def test_empty_description_allowed(self):
        """Test that empty description is valid"""
        data = {
            'name': 'My Project Test',
            'description': ''
        }
        serializer = self.get_serializer(data=data)

        self.assertTrue(serializer.is_valid())
        
    def test_name_trimmed(self):
        """Test that name is trimmed of whitespace"""
        data = {
            'name': '   My Trimmed Project   ',
            'description': 'A description.'
        }
        serializer = self.get_serializer(data=data)

        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['name'], 'My Trimmed Project')

    def test_duplicate_name_for_same_user(self):
        """Test that duplicate project names for the same user are invalid"""
        data = {
            'name': 'Unique Project',
            'description': 'First project description.'
        }
        
        # Create the first project
        serializer1 = self.get_serializer(data=data)
        self.assertTrue(serializer1.is_valid())
        serializer1.save(user=self.user)

        # Attempt to create a duplicate project
        serializer2 = self.get_serializer(data=data)
        self.assertFalse(serializer2.is_valid())
        
        self.assertIn('non_field_errors', serializer2.errors)
        self.assertIn("already exists", str(serializer2.errors['non_field_errors']))
