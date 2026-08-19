from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


@override_settings(RATELIMIT_ENABLE=True)
class AuthThrottlingTest(APITestCase):
    """Tests that rate limiting actually blocks on sensitive auth endpoints"""

    def setUp(self):
        """Set up test data and start from a clean rate-limit counter"""
        cache.clear()
        self.login_url = "/api/auth/login/"
        self.credentials = {
            "email": "throttle@example.com",
            "password": "SecureP@ss123",
        }
        User.objects.create_user(
            email="throttle@example.com",
            first_name="Throttle",
            last_name="User",
            password="SecureP@ss123",
        )

    def tearDown(self):
        """Leave the shared rate-limit counter clean for the other tests"""
        cache.clear()

    def test_login_blocks_beyond_rate_limit(self):
        """Test : login allows 5 requests per minute then blocks with 403"""
        for attempt in range(5):
            response = self.client.post(self.login_url, self.credentials)
            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                f"request {attempt + 1} should still be allowed",
            )

        response = self.client.post(self.login_url, self.credentials)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_login_quota_is_consumed_by_failed_attempts(self):
        """Test : wrong passwords consume the login quota, blocking brute force"""
        wrong_credentials = {
            "email": "throttle@example.com",
            "password": "WrongP@ss123",
        }
        for _ in range(5):
            self.client.post(self.login_url, wrong_credentials)

        response = self.client.post(self.login_url, self.credentials)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
