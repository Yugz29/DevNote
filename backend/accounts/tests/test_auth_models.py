from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db.utils import IntegrityError
import uuid

User = get_user_model()

class UserModelTest(TestCase):
    """Tests for model User"""

    def test_create_user_with_all_fields(self):
        """Test : create user with all required fields"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )

        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@example.com')
        self.assertEqual(user.first_name, 'John')
        self.assertEqual(user.last_name, 'Doe')
        self.assertTrue(user.check_password('SecureP@ss123'))
        self.assertTrue(user.is_active)

    def test_user_id_is_uuid(self):
        """Test : ID is UUID ?"""
        user = User.objects.create_user(
            email='test@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )

        self.assertIsInstance(user.id, uuid.UUID)
        self.assertEqual(len(str(user.id)), 36)

    def test_timestamps_auto_generated(self):
        """Test : created_at and updated_at are autogenerate"""
        user = User.objects.create_user(
            email='test@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )

        self.assertIsNotNone(user.created_at)
        self.assertIsNotNone(user.updated_at)

    def test_email_is_unique(self):
        """Test : email is unique"""
        user = User.objects.create_user(
            email='test@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )

        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                email='test@example.com',
                first_name='Jane',
                last_name='Smith',
                password='AnotherP@ss456'
            )
    
    def test_username_is_optional(self):
        """Test : username can be NULL"""
        user = User.objects.create_user(
            email='test@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )

        self.assertIsNotNone(user.username)
        self.assertTrue(user.username.startswith('user_'))

    def test_username_is_unique_if_provided(self):
        """Test : If provided, username must be unique"""
        User.objects.create_user(
            username='testuser',
            email='test1@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )

        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                username='testuser',
                email='test2@example.com',
                first_name='Jane',
                last_name='Smith',
                password='AnotherP@ss456'
            )

    def test_str_return_username(self):
        """Test : __str___ return username"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )

        self.assertEqual(str(user), 'test@example.com')

    def test_str_when_username_is_none(self):
        """Test : __str__ handles the case where username = None"""
        user = User.objects.create_user(
            email='test@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )
        
        self.assertEqual(str(user), 'test@example.com')

    def test_email_is_username_field(self):
        """Test : authentication is done by email"""
        self.assertEqual(User.USERNAME_FIELD, 'email')

    def test_required_fileds_are_correct(self):
        """Test : the required fields are first_name and last_name."""
        self.assertEqual(User.REQUIRED_FIELDS, ['first_name', 'last_name'])
