from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from django.test import override_settings

User = get_user_model()


@override_settings(RATELIMIT_ENABLE=False)
class AuthViewsTest(APITestCase):
    """Tests for authentication API endpoints"""

    def setUp(self):
        """Set up test data"""
        self.register_url = '/api/auth/register/'
        self.login_url = '/api/auth/login/'
        self.logout_url = '/api/auth/logout/'
        self.user_url = '/api/auth/me/'

        self.valid_user_data = {
            'username': 'johndoe',
            'email': 'john@example.com',
            'first_name': 'John',
            'last_name': 'Doe',
            'password': 'SecureP@ss123',
            'password2': 'SecureP@ss123'
        }

    # ===== REGISTRATION TESTS =====

    def test_register_valid_user(self):
        """Test: Register with valid data returns 201 and user info"""
        response = self.client.post(self.register_url, self.valid_user_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'john@example.com')
        self.assertEqual(response.data['user']['username'], 'johndoe')
        # Tokens are set as HTTPOnly cookies, not in response body
        self.assertIn('access_token', response.cookies)
        self.assertIn('refresh_token', response.cookies)

    def test_register_password_mismatch(self):
        """Test: Registration fails if password != password2"""
        invalid_data = self.valid_user_data.copy()
        invalid_data['password2'] = 'DifferentPass123'

        response = self.client.post(self.register_url, invalid_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_register_missing_required_fields(self):
        """Test: Registration fails if required fields are missing"""
        incomplete_data = {'email': 'incomplete@example.com'}

        response = self.client.post(self.register_url, incomplete_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            'password' in response.data or
            'first_name' in response.data
        )

    def test_register_duplicate_email(self):
        """Test: Registration fails if email already exists"""
        self.client.post(self.register_url, self.valid_user_data)

        duplicate_data = self.valid_user_data.copy()
        duplicate_data['username'] = 'janedoe'

        response = self.client.post(self.register_url, duplicate_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    # ===== LOGIN TESTS =====

    def test_login_valid_credentials(self):
        """Test: Login with valid credentials sets cookies and returns user info"""
        self.client.post(self.register_url, self.valid_user_data)

        login_data = {
            'email': 'john@example.com',
            'password': 'SecureP@ss123'
        }
        response = self.client.post(self.login_url, login_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'john@example.com')
        # Tokens are set as HTTPOnly cookies, not in response body
        self.assertIn('access_token', response.cookies)
        self.assertIn('refresh_token', response.cookies)

    def test_login_invalid_credentials(self):
        """Test: Login with invalid credentials returns 400"""
        self.client.post(self.register_url, self.valid_user_data)

        login_data = {
            'email': 'john@example.com',
            'password': 'WrongPassword123'
        }
        response = self.client.post(self.login_url, login_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_nonexistent_user(self):
        """Test: Login with non-existent user returns 400"""
        login_data = {
            'email': 'ghost@example.com',
            'password': 'AnyPassword123'
        }
        response = self.client.post(self.login_url, login_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ===== LOGOUT TESTS =====

    def test_logout_authenticated(self):
        """Test: POST /api/auth/logout/ succeeds when authenticated"""
        user = User.objects.create_user(
            username='johndoe',
            email='john@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(self.logout_url)

        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]
        )

    def test_logout_unauthenticated(self):
        """Test: POST /api/auth/logout/ returns 401 without authentication"""
        response = self.client.post(self.logout_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ===== USER PROFILE TESTS =====

    def test_user_profile_authenticated(self):
        """Test: GET /api/auth/me/ returns user info when authenticated"""
        user = User.objects.create_user(
            username='johndoe',
            email='john@example.com',
            first_name='John',
            last_name='Doe',
            password='SecureP@ss123'
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(self.user_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'johndoe')
        self.assertEqual(response.data['email'], 'john@example.com')

    def test_user_profile_unauthenticated(self):
        """Test: GET /api/auth/me/ returns 401 without authentication"""
        response = self.client.get(self.user_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
