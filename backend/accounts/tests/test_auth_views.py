from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from workspace.models import TODO, Document, Folder, Project, Snippet, TodoList

User = get_user_model()


@override_settings(RATELIMIT_ENABLE=False)
class AuthViewsTest(APITestCase):
    """Tests for authentication API endpoints"""

    def setUp(self):
        """Set up test data"""
        self.register_url = "/api/auth/register/"
        self.login_url = "/api/auth/login/"
        self.logout_url = "/api/auth/logout/"
        self.user_url = "/api/auth/me/"

        self.valid_user_data = {
            "username": "johndoe",
            "email": "john@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "password": "SecureP@ss123",
            "password2": "SecureP@ss123",
        }

    # ===== REGISTRATION TESTS =====

    def test_register_valid_user(self):
        """Test: Register with valid data returns 201 and user info"""
        response = self.client.post(self.register_url, self.valid_user_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["email"], "john@example.com")
        self.assertEqual(response.data["user"]["username"], "johndoe")
        # Tokens are set as HTTPOnly cookies, not in response body
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)

    def test_register_password_mismatch(self):
        """Test: Registration fails if password != password2"""
        invalid_data = self.valid_user_data.copy()
        invalid_data["password2"] = "DifferentPass123"

        response = self.client.post(self.register_url, invalid_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_register_missing_required_fields(self):
        """Test: Registration fails if required fields are missing"""
        incomplete_data = {"email": "incomplete@example.com"}

        response = self.client.post(self.register_url, incomplete_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue("password" in response.data or "first_name" in response.data)

    def test_register_duplicate_email(self):
        """Test: Registration fails if email already exists"""
        self.client.post(self.register_url, self.valid_user_data)

        duplicate_data = self.valid_user_data.copy()
        duplicate_data["username"] = "janedoe"

        response = self.client.post(self.register_url, duplicate_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    # ===== LOGIN TESTS =====

    def test_login_valid_credentials(self):
        """Test: Login with valid credentials sets cookies and returns user info"""
        self.client.post(self.register_url, self.valid_user_data)

        login_data = {"email": "john@example.com", "password": "SecureP@ss123"}
        response = self.client.post(self.login_url, login_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["email"], "john@example.com")
        # Tokens are set as HTTPOnly cookies, not in response body
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)

    def test_login_invalid_credentials(self):
        """Test: Login with invalid credentials returns 400"""
        self.client.post(self.register_url, self.valid_user_data)

        login_data = {"email": "john@example.com", "password": "WrongPassword123"}
        response = self.client.post(self.login_url, login_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_nonexistent_user(self):
        """Test: Login with non-existent user returns 400"""
        login_data = {"email": "ghost@example.com", "password": "AnyPassword123"}
        response = self.client.post(self.login_url, login_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ===== LOGOUT TESTS =====

    def test_logout_authenticated(self):
        """Test: POST /api/auth/logout/ succeeds when authenticated"""
        user = User.objects.create_user(
            username="johndoe",
            email="john@example.com",
            first_name="John",
            last_name="Doe",
            password="SecureP@ss123",
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(self.logout_url)

        self.assertIn(
            response.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]
        )

    def test_logout_unauthenticated(self):
        """Test: POST /api/auth/logout/ returns 401 without authentication"""
        response = self.client.post(self.logout_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ===== USER PROFILE TESTS =====

    def test_user_profile_authenticated(self):
        """Test: GET /api/auth/me/ returns user info when authenticated"""
        user = User.objects.create_user(
            username="johndoe",
            email="john@example.com",
            first_name="John",
            last_name="Doe",
            password="SecureP@ss123",
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(self.user_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "johndoe")
        self.assertEqual(response.data["email"], "john@example.com")

    def test_user_profile_unauthenticated(self):
        """Test: GET /api/auth/me/ returns 401 without authentication"""
        response = self.client.get(self.user_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(RATELIMIT_ENABLE=False)
class ChangePasswordViewTest(APITestCase):
    """Tests for the POST /api/auth/password/ endpoint"""

    def setUp(self):
        """Set up an authenticated user and the payload it would send"""
        self.url = "/api/auth/password/"
        self.login_url = "/api/auth/login/"
        self.current_password = "SecureP@ss123"
        self.user = User.objects.create_user(
            username="johndoe",
            email="john@example.com",
            first_name="John",
            last_name="Doe",
            password=self.current_password,
        )
        self.client.force_authenticate(user=self.user)

        self.valid_payload = {
            "current_password": self.current_password,
            "new_password": "BrandN3w@Pass",
            "new_password2": "BrandN3w@Pass",
        }

    def test_change_password_success(self):
        """Test: a valid payload replaces the password"""
        response = self.client.post(self.url, self.valid_payload)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandN3w@Pass"))
        self.assertFalse(self.user.check_password(self.current_password))

    def test_change_password_issues_fresh_cookies(self):
        """Test: the response re-authenticates the browser it came from"""
        response = self.client.post(self.url, self.valid_payload)

        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)
        self.assertTrue(response.cookies["access_token"].value)
        self.assertTrue(response.cookies["refresh_token"].value)

    def test_change_password_blacklists_previous_refresh_tokens(self):
        """Test: refresh tokens issued before the change stop working"""
        old_refresh = str(RefreshToken.for_user(self.user))

        self.client.post(self.url, self.valid_payload)

        self.client.force_authenticate(user=None)
        self.client.cookies["refresh_token"] = old_refresh
        response = self.client.post("/api/auth/refresh/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_wrong_current_password(self):
        """Test: the change is refused without the current password"""
        payload = self.valid_payload.copy()
        payload["current_password"] = "NotMyP@ssw0rd"

        response = self.client.post(self.url, payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.current_password))

    def test_change_password_confirmation_mismatch(self):
        """Test: the two new password fields have to match"""
        payload = self.valid_payload.copy()
        payload["new_password2"] = "SomethingElse@1"

        response = self.client.post(self.url, payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.current_password))

    def test_change_password_rejects_weak_password(self):
        """Test: the project password validators apply to the new password"""
        payload = self.valid_payload.copy()
        payload["new_password"] = "123"
        payload["new_password2"] = "123"

        response = self.client.post(self.url, payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

    def test_change_password_rejects_reusing_the_current_one(self):
        """Test: a change has to actually change something"""
        payload = {
            "current_password": self.current_password,
            "new_password": self.current_password,
            "new_password2": self.current_password,
        }

        response = self.client.post(self.url, payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

    def test_change_password_missing_fields(self):
        """Test: all three fields are required"""
        response = self.client.post(self.url, {})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        for field in ["current_password", "new_password", "new_password2"]:
            self.assertIn(field, response.data)

    def test_change_password_unauthenticated(self):
        """Test: POST /api/auth/password/ returns 401 without authentication"""
        self.client.force_authenticate(user=None)

        response = self.client.post(self.url, self.valid_payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_leaves_other_users_alone(self):
        """Test: only the caller's password moves"""
        other = User.objects.create_user(
            username="janedoe",
            email="jane@example.com",
            first_name="Jane",
            last_name="Doe",
            password="OtherP@ss123",
        )

        self.client.post(self.url, self.valid_payload)

        other.refresh_from_db()
        self.assertTrue(other.check_password("OtherP@ss123"))

    def test_login_works_with_the_new_password(self):
        """Test: the new password is the one that signs you back in"""
        self.client.post(self.url, self.valid_payload)
        self.client.force_authenticate(user=None)

        refused = self.client.post(
            self.login_url,
            {"email": "john@example.com", "password": self.current_password},
        )
        accepted = self.client.post(
            self.login_url, {"email": "john@example.com", "password": "BrandN3w@Pass"}
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)


@override_settings(RATELIMIT_ENABLE=False)
class DeleteAccountViewTest(APITestCase):
    """Tests for the DELETE /api/auth/account/ endpoint"""

    def setUp(self):
        """Set up an authenticated user carrying a full workspace"""
        self.url = "/api/auth/account/delete/"
        self.login_url = "/api/auth/login/"
        self.password = "SecureP@ss123"
        self.user = User.objects.create_user(
            username="johndoe",
            email="john@example.com",
            first_name="John",
            last_name="Doe",
            password=self.password,
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Doomed Project",
            description="Everything under it should go too.",
            user=self.user,
        )
        self.folder = Folder.objects.create(name="Docs", project=self.project)
        Document.objects.create(
            title="A document", content="...", project=self.project, folder=self.folder
        )
        Snippet.objects.create(
            title="A snippet",
            content="print(1)",
            language="python",
            project=self.project,
        )
        self.todo_list = TodoList.objects.create(name="Sprint 1", project=self.project)
        TODO.objects.create(title="A todo", project=self.project, list=self.todo_list)

    def test_delete_account_success(self):
        """Test: the account is removed with the right password"""
        response = self.client.post(
            self.url, {"current_password": self.password}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(email="john@example.com").exists())

    def test_delete_account_cascades_to_every_owned_object(self):
        """Test: nothing owned by the user survives them"""
        self.client.post(self.url, {"current_password": self.password}, format="json")

        self.assertEqual(Project.objects.count(), 0)
        self.assertEqual(Folder.objects.count(), 0)
        self.assertEqual(Document.objects.count(), 0)
        self.assertEqual(Snippet.objects.count(), 0)
        self.assertEqual(TodoList.objects.count(), 0)
        self.assertEqual(TODO.objects.count(), 0)

    def test_delete_account_clears_the_auth_cookies(self):
        """Test: the browser is left signed out"""
        response = self.client.post(
            self.url, {"current_password": self.password}, format="json"
        )

        self.assertEqual(response.cookies["access_token"].value, "")
        self.assertEqual(response.cookies["refresh_token"].value, "")

    def test_delete_account_wrong_password(self):
        """Test: a wrong password refuses the deletion"""
        response = self.client.post(
            self.url, {"current_password": "NotMyP@ssw0rd"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)
        self.assertTrue(User.objects.filter(email="john@example.com").exists())
        self.assertEqual(Project.objects.count(), 1)

    def test_delete_account_missing_password(self):
        """Test: the password is not optional"""
        response = self.client.post(self.url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)
        self.assertTrue(User.objects.filter(email="john@example.com").exists())

    def test_delete_account_unauthenticated(self):
        """Test: POST /api/auth/account/delete/ returns 401 without authentication"""
        self.client.force_authenticate(user=None)

        response = self.client.post(
            self.url, {"current_password": self.password}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(User.objects.filter(email="john@example.com").exists())

    def test_delete_account_leaves_other_users_alone(self):
        """Test: only the caller's workspace is destroyed"""
        other = User.objects.create_user(
            username="janedoe",
            email="jane@example.com",
            first_name="Jane",
            last_name="Doe",
            password="OtherP@ss123",
        )
        other_project = Project.objects.create(title="Kept", user=other)

        self.client.post(self.url, {"current_password": self.password}, format="json")

        self.assertTrue(User.objects.filter(email="jane@example.com").exists())
        self.assertTrue(Project.objects.filter(id=other_project.id).exists())

    def test_deleted_account_cannot_log_back_in(self):
        """Test: the credentials no longer open anything"""
        self.client.post(self.url, {"current_password": self.password}, format="json")
        self.client.force_authenticate(user=None)

        response = self.client.post(
            self.login_url, {"email": "john@example.com", "password": self.password}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
