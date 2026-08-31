from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.utils import IntegrityError
from django.test import TestCase
from django.utils import timezone

from accounts.models import ApiToken
from accounts.tokens import TOKEN_PREFIX, hash_token

User = get_user_model()


class ApiTokenModelTest(TestCase):
    """Tests for the ApiToken model and its manager"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="token@example.com",
            password="SecureP@ss123",
            first_name="Token",
            last_name="Owner",
        )

    def test_create_token_returns_raw_secret_once(self):
        """Test: minting returns a prefixed secret the database never stores"""
        token, raw_token = ApiToken.objects.create_token(self.user, "Automation")

        self.assertTrue(raw_token.startswith(TOKEN_PREFIX))
        self.assertEqual(token.token_hash, hash_token(raw_token))
        self.assertNotIn(raw_token, token.token_hash)
        self.assertTrue(raw_token[len(TOKEN_PREFIX) :].startswith(token.prefix))

    def test_secret_is_unique_per_token(self):
        """Test: two tokens never share a secret"""
        _, first = ApiToken.objects.create_token(self.user, "First")
        _, second = ApiToken.objects.create_token(self.user, "Second")

        self.assertNotEqual(first, second)

    def test_resolve_finds_the_token_behind_a_secret(self):
        """Test: resolve maps a raw secret back to its row"""
        token, raw_token = ApiToken.objects.create_token(self.user, "Automation")

        self.assertEqual(ApiToken.objects.resolve(raw_token), token)
        self.assertIsNone(ApiToken.objects.resolve(f"{TOKEN_PREFIX}nonsense"))

    def test_active_leaves_expired_tokens_out(self):
        """Test: active() keeps endless and future tokens, drops expired ones"""
        endless, _ = ApiToken.objects.create_token(self.user, "Endless")
        future, _ = ApiToken.objects.create_token(
            self.user, "Future", timezone.now() + timedelta(days=1)
        )
        expired, _ = ApiToken.objects.create_token(
            self.user, "Expired", timezone.now() - timedelta(seconds=1)
        )

        active = set(ApiToken.objects.active())

        self.assertIn(endless, active)
        self.assertIn(future, active)
        self.assertNotIn(expired, active)

    def test_is_expired_follows_the_expiry_date(self):
        """Test: is_expired is false without a date, true once it has passed"""
        endless, _ = ApiToken.objects.create_token(self.user, "Endless")
        expired, _ = ApiToken.objects.create_token(
            self.user, "Expired", timezone.now() - timedelta(seconds=1)
        )

        self.assertFalse(endless.is_expired())
        self.assertTrue(expired.is_expired())

    def test_touch_records_first_use(self):
        """Test: touch stamps a token that was never used"""
        token, _ = ApiToken.objects.create_token(self.user, "Automation")

        token.touch()
        token.refresh_from_db()

        self.assertIsNotNone(token.last_used_at)

    def test_touch_skips_a_write_within_the_resolution_window(self):
        """Test: a token used twice in a row is only stamped once"""
        token, _ = ApiToken.objects.create_token(self.user, "Automation")

        token.touch()
        first = token.last_used_at
        token.touch()
        token.refresh_from_db()

        self.assertEqual(token.last_used_at, first)

    def test_name_is_unique_per_user(self):
        """Test: the same user cannot label two tokens alike"""
        ApiToken.objects.create_token(self.user, "Automation")

        with self.assertRaises(IntegrityError), transaction.atomic():
            ApiToken.objects.create_token(self.user, "Automation")

    def test_another_user_may_reuse_a_name(self):
        """Test: names collide per user, not across the whole table"""
        other = User.objects.create_user(
            email="other@example.com",
            password="SecureP@ss123",
            first_name="Other",
            last_name="User",
        )

        ApiToken.objects.create_token(self.user, "Automation")
        token, _ = ApiToken.objects.create_token(other, "Automation")

        self.assertEqual(token.user, other)

    def test_deleting_the_user_takes_their_tokens(self):
        """Test: tokens die with the account they belong to"""
        ApiToken.objects.create_token(self.user, "Automation")

        self.user.delete()

        self.assertEqual(ApiToken.objects.count(), 0)
