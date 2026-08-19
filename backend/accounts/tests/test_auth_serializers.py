from django.contrib.auth import get_user_model
from django.test import TestCase

from accounts.serializers import LoginSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterSerializerTest(TestCase):
    """Tests for RegisterSerializer"""

    def test_valid_registration_data(self):
        """Test : valid data creates a user"""
        data = {
            "email": "newuser@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "password": "SecureP@ss123",
            "password2": "SecureP@ss123",
        }
        serializer = RegisterSerializer(data=data)

        self.assertTrue(serializer.is_valid())
        user = serializer.save()

        self.assertEqual(user.email, "newuser@example.com")
        self.assertEqual(user.first_name, "John")
        self.assertEqual(user.last_name, "Doe")
        self.assertTrue(user.check_password("SecureP@ss123"))

    def test_password_must_match(self):
        """Test : password and password2 must match"""
        data = {
            "email": "newuser@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "password": "SecureP@ss123",
            "password2": "DifferentP@ss456",
        }
        serializer = RegisterSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("password", serializer.errors)

    def test_password_too_close_to_the_email(self):
        """Test: a password built from the email is refused"""
        data = {
            "username": "johndoe",
            "email": "johndoe@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "password": "johndoe@example.com",
            "password2": "johndoe@example.com",
        }

        serializer = RegisterSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("password", serializer.errors)

    def test_password_too_close_to_the_name(self):
        """Test: a password built from the name is refused"""
        data = {
            "username": "bartholomew",
            "email": "someone@example.com",
            "first_name": "Bartholomew",
            "last_name": "Kensington",
            "password": "Bartholomew",
            "password2": "Bartholomew",
        }

        serializer = RegisterSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("password", serializer.errors)

    def test_weak_password_is_refused(self):
        """Test: the project password validators still apply"""
        data = {
            "username": "johndoe",
            "email": "john@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "password": "password",
            "password2": "password",
        }

        serializer = RegisterSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("password", serializer.errors)

    def test_email_must_be_unique(self):
        """Test : email must be unique"""
        User.objects.create_user(
            email="existing@example.com",
            first_name="Jane",
            last_name="Smith",
            password="SecureP@ss123",
        )

        data = {
            "email": "existing@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "password": "SecureP@ss123",
            "password2": "SecureP@ss123",
        }
        serializer = RegisterSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_email_format_validation(self):
        """Test : email must be a valid format"""
        data = {
            "email": "invalid-email",
            "first_name": "John",
            "last_name": "Doe",
            "password": "SecureP@ss123",
            "password2": "SecureP@ss123",
        }
        serializer = RegisterSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_required_fields(self):
        """Test : all required fields must be provided"""
        data = {}
        serializer = RegisterSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)
        self.assertIn("first_name", serializer.errors)
        self.assertIn("last_name", serializer.errors)
        self.assertIn("password", serializer.errors)
        self.assertIn("password2", serializer.errors)

    def test_password_not_in_output(self):
        """Test : password fields are write-only"""
        data = {
            "email": "newuser@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "password": "SecureP@ss123",
            "password2": "SecureP@ss123",
        }
        serializer = RegisterSerializer(data=data)
        serializer.is_valid()
        user = serializer.save()

        output = RegisterSerializer(user).data

        self.assertNotIn("password", output)
        self.assertNotIn("password2", output)


class LoginSerializerTest(TestCase):
    """Test for LoginSerializer"""

    def setUp(self):
        """Test : create user before each test"""
        self.user = User.objects.create_user(
            email="testuser@example.com",
            first_name="Test",
            last_name="User",
            password="SecureP@ss123",
        )

    def test_valid_login_data(self):
        """Test : valid credential return user"""
        data = {"email": "testuser@example.com", "password": "SecureP@ss123"}
        serializer = LoginSerializer(data=data)

        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["user"], self.user)

    def test_invalid_email(self):
        """Test : non existant email raises error"""
        data = {"email": "doesntexist@example.com", "password": "SecureP@ss123"}
        serializer = LoginSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_required_fields_login(self):
        """Test : email and password are required"""
        data = {}
        serializer = LoginSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)
        self.assertIn("password", serializer.errors)


class UserSerializerTest(TestCase):
    """Test for UserSerializer"""

    def test_user_serialization(self):
        """Test : user is correctly serialized"""
        user = User.objects.create_user(
            email="testuser@example.com",
            first_name="John",
            last_name="Doe",
            password="SecureP@ss123",
        )
        serializer = UserSerializer(user)
        data = serializer.data

        self.assertEqual(data["email"], "testuser@example.com")
        self.assertEqual(data["first_name"], "John")
        self.assertEqual(data["last_name"], "Doe")
        self.assertIn("id", data)
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)

    def test_password_not_in_serialization(self):
        """Test : password is not included in serialization"""
        user = User.objects.create_user(
            email="testuser@example.com",
            first_name="John",
            last_name="Doe",
            password="SecureP@ss123",
        )
        serializer = UserSerializer(user)
        data = serializer.data

        self.assertNotIn("password", data)

    def test_username_in_serialization(self):
        """Test : username is included in serialization"""
        user = User.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            first_name="John",
            last_name="Doe",
            password="SecureP@ss123",
        )
        serializer = UserSerializer(user)
        data = serializer.data

        self.assertIn("username", data)
        self.assertEqual(data["username"], "testuser")
