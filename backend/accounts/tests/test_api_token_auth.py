from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import ApiToken
from accounts.tokens import TOKEN_PREFIX
from workspace.models import Document, Project

User = get_user_model()


@override_settings(RATELIMIT_ENABLE=False)
class ApiTokenAuthenticationTest(APITestCase):
    """Tests for authenticating workspace calls with a personal API token"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="SecureP@ss123",
            first_name="Owner",
            last_name="User",
        )
        self.project = Project.objects.create(title="Automated", user=self.user)
        self.token, self.raw_token = ApiToken.objects.create_token(
            self.user, "Automation"
        )
        self.projects_url = "/api/projects/"
        self.documents_url = f"/api/projects/{self.project.id}/documents/"

    def authorize(self, raw_token, scheme="Bearer"):
        self.client.credentials(HTTP_AUTHORIZATION=f"{scheme} {raw_token}")

    def test_token_reads_the_owner_projects(self):
        """Test: a valid token authenticates a GET without any cookie"""
        self.authorize(self.raw_token)

        response = self.client.get(self.projects_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["title"], "Automated")

    def test_token_scheme_is_accepted_too(self):
        """Test: 'Token <secret>' works like 'Bearer <secret>'"""
        self.authorize(self.raw_token, scheme="Token")

        response = self.client.get(self.projects_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_token_writes_a_document_without_a_csrf_token(self):
        """
        Test: a header credential needs no CSRF token, unlike a cookie one
        """
        self.authorize(self.raw_token)

        response = self.client.post(
            self.documents_url,
            {"title": "Written by a robot", "content": "# Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Document.objects.get().title, "Written by a robot")

    def test_token_only_reaches_its_own_owner_data(self):
        """Test: a token carries the isolation of the account behind it"""
        stranger = User.objects.create_user(
            email="stranger@example.com",
            password="SecureP@ss123",
            first_name="Stranger",
            last_name="User",
        )
        Project.objects.create(title="Not yours", user=stranger)

        self.authorize(self.raw_token)
        response = self.client.get(self.projects_url)

        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "Automated")

    def test_unknown_token_is_refused(self):
        """Test: a secret nothing matches gets a 401"""
        self.authorize(f"{TOKEN_PREFIX}totally-made-up")

        response = self.client.get(self.projects_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_expired_token_is_refused(self):
        """Test: a token past its expiry date stops working"""
        token, raw_token = ApiToken.objects.create_token(
            self.user, "Old", timezone.now() - timedelta(seconds=1)
        )
        self.authorize(raw_token)

        response = self.client.get(self.projects_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("expired", str(response.data["detail"]).lower())

    def test_revoked_token_is_refused(self):
        """Test: deleting the row cuts the client off at its next request"""
        self.authorize(self.raw_token)
        self.token.delete()

        response = self.client.get(self.projects_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_of_an_inactive_user_is_refused(self):
        """Test: deactivating an account disables its tokens"""
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        self.authorize(self.raw_token)

        response = self.client.get(self.projects_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_use_stamps_the_token(self):
        """Test: an authenticated call records when the token was last used"""
        self.authorize(self.raw_token)

        self.client.get(self.projects_url)
        self.token.refresh_from_db()

        self.assertIsNotNone(self.token.last_used_at)

    def test_a_jwt_on_the_same_header_still_authenticates(self):
        """
        Test: the token authenticator steps aside for anything that is not
        one of its own, so bearer JWTs keep working
        """
        access = str(RefreshToken.for_user(self.user).access_token)
        self.authorize(access)

        response = self.client.get(self.projects_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_no_credential_is_still_refused(self):
        """Test: nothing on the header leaves the request anonymous"""
        response = self.client.get(self.projects_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
