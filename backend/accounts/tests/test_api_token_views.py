from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import ApiToken
from accounts.tokens import DEFAULT_EXPIRY_DAYS, MAX_EXPIRY_DAYS, TOKEN_PREFIX

User = get_user_model()

TOKENS_URL = "/api/auth/tokens/"


@override_settings(RATELIMIT_ENABLE=False)
class ApiTokenViewsTest(APITestCase):
    """Tests for the API token management endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="SecureP@ss123",
            first_name="Owner",
            last_name="User",
        )
        self.client.force_authenticate(user=self.user)

    def test_create_returns_the_secret_once(self):
        """Test: creation answers with the raw token and its metadata"""
        response = self.client.post(TOKENS_URL, {"name": "Automation"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["token"].startswith(TOKEN_PREFIX))
        self.assertEqual(response.data["name"], "Automation")
        self.assertEqual(response.data["prefix"], ApiToken.objects.get().prefix)

    def test_created_token_expires_after_the_default_lifetime(self):
        """Test: a token asked for without a lifetime gets the default one"""
        self.client.post(TOKENS_URL, {"name": "Automation"}, format="json")

        token = ApiToken.objects.get()
        expected = timezone.now() + timedelta(days=DEFAULT_EXPIRY_DAYS)

        self.assertLess(abs((token.expires_at - expected).total_seconds()), 60)

    def test_explicit_null_lifetime_never_expires(self):
        """Test: passing null asks for a token without an expiry date"""
        response = self.client.post(
            TOKENS_URL,
            {"name": "Automation", "expires_in_days": None},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(ApiToken.objects.get().expires_at)

    def test_lifetime_is_capped(self):
        """Test: an absurd lifetime is refused"""
        response = self.client.post(
            TOKENS_URL,
            {"name": "Automation", "expires_in_days": MAX_EXPIRY_DAYS + 1},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expires_in_days", response.data)

    def test_blank_name_is_refused(self):
        """Test: a token needs a label to be told apart later"""
        response = self.client.post(TOKENS_URL, {"name": "   "}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_duplicate_name_is_refused(self):
        """Test: two tokens of one account cannot share a label"""
        ApiToken.objects.create_token(self.user, "Automation")

        response = self.client.post(TOKENS_URL, {"name": "Automation"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_list_never_carries_the_secret(self):
        """Test: listing shows metadata only, the secret is gone for good"""
        _, raw_token = ApiToken.objects.create_token(self.user, "Automation")

        response = self.client.get(TOKENS_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("token", response.data[0])
        self.assertNotIn(raw_token, str(response.data))

    def test_list_is_scoped_to_the_owner(self):
        """Test: a user never sees the tokens of another account"""
        stranger = User.objects.create_user(
            email="stranger@example.com",
            password="SecureP@ss123",
            first_name="Stranger",
            last_name="User",
        )
        ApiToken.objects.create_token(stranger, "Not yours")
        ApiToken.objects.create_token(self.user, "Mine")

        response = self.client.get(TOKENS_URL)

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Mine")

    def test_list_reports_expiry(self):
        """Test: an expired token is listed and flagged as such"""
        ApiToken.objects.create_token(
            self.user, "Old", timezone.now() - timedelta(seconds=1)
        )

        response = self.client.get(TOKENS_URL)

        self.assertTrue(response.data[0]["is_expired"])

    def test_revoke_deletes_the_token(self):
        """Test: DELETE drops the row"""
        token, _ = ApiToken.objects.create_token(self.user, "Automation")

        response = self.client.delete(f"{TOKENS_URL}{token.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(ApiToken.objects.count(), 0)

    def test_revoking_someone_else_token_is_refused(self):
        """Test: a token of another account is out of reach"""
        stranger = User.objects.create_user(
            email="stranger@example.com",
            password="SecureP@ss123",
            first_name="Stranger",
            last_name="User",
        )
        token, _ = ApiToken.objects.create_token(stranger, "Not yours")

        response = self.client.delete(f"{TOKENS_URL}{token.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(ApiToken.objects.count(), 1)

    def test_anonymous_cannot_list_tokens(self):
        """Test: the endpoint is closed without a session"""
        self.client.force_authenticate(user=None)

        response = self.client.get(TOKENS_URL)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(RATELIMIT_ENABLE=False)
class ApiTokenPrivilegeTest(APITestCase):
    """A token must not be able to mint or revoke another token"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="SecureP@ss123",
            first_name="Owner",
            last_name="User",
        )
        self.token, self.raw_token = ApiToken.objects.create_token(
            self.user, "Automation"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.raw_token}")

    def test_a_token_cannot_list_tokens(self):
        """Test: the management endpoint ignores token credentials"""
        response = self.client.get(TOKENS_URL)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_a_token_cannot_mint_another_one(self):
        """Test: a leaked token cannot widen its own foothold"""
        response = self.client.post(TOKENS_URL, {"name": "Second"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(ApiToken.objects.count(), 1)

    def test_a_token_cannot_revoke_another_one(self):
        """Test: a leaked token cannot lock its owner out"""
        response = self.client.delete(f"{TOKENS_URL}{self.token.id}/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(ApiToken.objects.count(), 1)
