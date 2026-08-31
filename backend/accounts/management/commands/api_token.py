"""Issue, list and revoke personal API tokens from the command line."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import ApiToken
from accounts.tokens import DEFAULT_EXPIRY_DAYS, MAX_EXPIRY_DAYS

User = get_user_model()


class Command(BaseCommand):
    help = "Manage the personal API tokens of a DevNote account"

    def add_arguments(self, parser):
        parser.add_argument(
            "action",
            choices=["create", "list", "revoke"],
            help="What to do with the tokens",
        )
        parser.add_argument(
            "--email",
            help="Account the token belongs to, required for create and revoke",
        )
        parser.add_argument("--name", help="Label of the token")
        parser.add_argument("--id", dest="token_id", help="Id of the token to revoke")
        parser.add_argument(
            "--expires-days",
            type=int,
            default=DEFAULT_EXPIRY_DAYS,
            help=f"Lifetime in days (default {DEFAULT_EXPIRY_DAYS})",
        )
        parser.add_argument(
            "--no-expiry",
            action="store_true",
            help="Issue a token that never expires",
        )

    def handle(self, *args, **options):
        action = options["action"]

        if action == "create":
            return self.create_token(options)

        if action == "revoke":
            return self.revoke_token(options)

        return self.list_tokens(options)

    def get_user(self, options):
        email = options.get("email")

        if not email:
            raise CommandError("--email is required.")

        try:
            return User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No account found for '{email}'.")

    def create_token(self, options):
        user = self.get_user(options)
        name = (options.get("name") or "").strip()

        if not name:
            raise CommandError("--name is required.")

        if ApiToken.objects.filter(user=user, name=name).exists():
            raise CommandError(
                f"A token named '{name}' already exists for {user.email}."
            )

        expires_at = None

        if not options["no_expiry"]:
            days = options["expires_days"]

            if days < 1 or days > MAX_EXPIRY_DAYS:
                raise CommandError(
                    f"--expires-days must be between 1 and {MAX_EXPIRY_DAYS}."
                )

            expires_at = timezone.now() + timedelta(days=days)

        token, raw_token = ApiToken.objects.create_token(user, name, expires_at)

        self.stdout.write(self.style.SUCCESS(f"Token '{token.name}' created."))
        self.stdout.write(f"  id      {token.id}")
        self.stdout.write(f"  owner   {user.email}")
        self.stdout.write(
            f"  expires {token.expires_at.date() if token.expires_at else 'never'}"
        )
        self.stdout.write("")
        self.stdout.write(raw_token)
        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "Copy it now: DevNote stores only its digest and cannot show it again."
            )
        )

    def list_tokens(self, options):
        tokens = ApiToken.objects.select_related("user")

        if options.get("email"):
            tokens = tokens.filter(user=self.get_user(options))

        if not tokens.exists():
            self.stdout.write("No API token.")
            return

        for token in tokens:
            state = "expired" if token.is_expired() else "active"
            used = token.last_used_at.date() if token.last_used_at else "never"
            expires = token.expires_at.date() if token.expires_at else "never"
            self.stdout.write(
                f"{token.id}  {token.user.email}  {token.name}  "
                f"{token.prefix}…  {state}  used:{used}  expires:{expires}"
            )

    def revoke_token(self, options):
        token_id = options.get("token_id")
        name = options.get("name")

        if not token_id and not name:
            raise CommandError("Pass --id or --name to say which token to revoke.")

        tokens = ApiToken.objects.all()

        if token_id:
            tokens = tokens.filter(id=token_id)
        else:
            tokens = tokens.filter(user=self.get_user(options), name=name)

        token = tokens.first()

        if token is None:
            raise CommandError("No matching token.")

        label = f"{token.name} ({token.user.email})"
        token.delete()

        self.stdout.write(self.style.SUCCESS(f"Token '{label}' revoked."))
