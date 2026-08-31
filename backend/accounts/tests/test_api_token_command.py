from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase
from django.utils import timezone

from accounts.models import ApiToken
from accounts.tokens import MAX_EXPIRY_DAYS, TOKEN_PREFIX

User = get_user_model()


class ApiTokenCommandTest(TestCase):
    """Tests for the manage.py api_token command"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="SecureP@ss123",
            first_name="Owner",
            last_name="User",
        )

    def run_command(self, *args, **options):
        out = StringIO()
        call_command("api_token", *args, stdout=out, **options)
        return out.getvalue()

    def test_create_prints_the_secret(self):
        """Test: creating from the CLI shows the raw token once"""
        output = self.run_command(
            "create", "--email", self.user.email, "--name", "Automation"
        )

        token = ApiToken.objects.get()

        self.assertIn(TOKEN_PREFIX, output)
        self.assertIn(str(token.id), output)
        self.assertEqual(token.name, "Automation")

    def test_create_applies_the_requested_lifetime(self):
        """Test: --expires-days sets the expiry date"""
        self.run_command(
            "create",
            "--email",
            self.user.email,
            "--name",
            "Automation",
            "--expires-days",
            "30",
        )

        token = ApiToken.objects.get()
        expected = timezone.now() + timedelta(days=30)

        self.assertLess(abs((token.expires_at - expected).total_seconds()), 60)

    def test_create_can_issue_an_endless_token(self):
        """Test: --no-expiry leaves the token without an expiry date"""
        self.run_command(
            "create",
            "--email",
            self.user.email,
            "--name",
            "Automation",
            "--no-expiry",
        )

        self.assertIsNone(ApiToken.objects.get().expires_at)

    def test_create_refuses_an_absurd_lifetime(self):
        """Test: the lifetime is capped like it is on the API"""
        with self.assertRaises(CommandError):
            self.run_command(
                "create",
                "--email",
                self.user.email,
                "--name",
                "Automation",
                "--expires-days",
                str(MAX_EXPIRY_DAYS + 1),
            )

    def test_create_refuses_an_unknown_account(self):
        """Test: a typo in the email stops the command"""
        with self.assertRaises(CommandError):
            self.run_command(
                "create", "--email", "nobody@example.com", "--name", "Automation"
            )

    def test_create_refuses_a_duplicate_name(self):
        """Test: the CLI enforces the same unique label as the API"""
        ApiToken.objects.create_token(self.user, "Automation")

        with self.assertRaises(CommandError):
            self.run_command(
                "create", "--email", self.user.email, "--name", "Automation"
            )

    def test_list_shows_the_tokens_without_their_secret(self):
        """Test: listing prints metadata, never the secret"""
        _, raw_token = ApiToken.objects.create_token(self.user, "Automation")

        output = self.run_command("list", "--email", self.user.email)

        self.assertIn("Automation", output)
        self.assertNotIn(raw_token, output)

    def test_list_says_when_there_is_nothing(self):
        """Test: an account without tokens gets a plain message"""
        output = self.run_command("list", "--email", self.user.email)

        self.assertIn("No API token", output)

    def test_revoke_by_name_deletes_the_token(self):
        """Test: --name revokes the matching token"""
        ApiToken.objects.create_token(self.user, "Automation")

        self.run_command("revoke", "--email", self.user.email, "--name", "Automation")

        self.assertEqual(ApiToken.objects.count(), 0)

    def test_revoke_by_id_deletes_the_token(self):
        """Test: --id revokes the matching token"""
        token, _ = ApiToken.objects.create_token(self.user, "Automation")

        self.run_command("revoke", "--id", str(token.id))

        self.assertEqual(ApiToken.objects.count(), 0)

    def test_revoke_needs_something_to_match_on(self):
        """Test: revoking blindly is refused"""
        with self.assertRaises(CommandError):
            self.run_command("revoke", "--email", self.user.email)
