"""
Authentication backends for DevNote

CookieJWTAuthentication serves browsers, reading the JWT pair from HttpOnly
cookies. ApiTokenAuthentication serves programmatic clients, reading a
long-lived personal token from the Authorization header.
"""

import logging

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from .models import ApiToken
from .tokens import looks_like_api_token

logger = logging.getLogger("accounts")


class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that reads tokens from cookies.
    Falls back to Authorization header if cookie is not found.

    Priority order:
    1. Check for token in cookies (primary method)
    2. Check for token in Authorization header (fallback for API clients)

    This allows:
    - Browser clients to use HTTPOnly cookies (secure)
    - API clients (Postman, mobile apps) to use Authorization header
    """

    def authenticate(self, request):
        """
        Authenticate the request and return a two-tuple of (user, token).

        Returns:
            tuple: (User, validated_token) if authentication successful
            None: if no authentication credentials provided

        Raises:
            AuthenticationFailed: if token is invalid
        """

        # Try to get the token from cookies first
        cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE", "access_token")
        raw_token = request.COOKIES.get(cookie_name)
        token_from_cookie = False

        if raw_token:
            token_from_cookie = True
            logger.debug(f"Found token in cookie: {cookie_name}")
        else:
            # Fallback to Authorization header
            logger.debug("No token in cookie, checking Authorization header")
            header = self.get_header(request)

            if header is None:
                logger.debug("No Authorization header found")
                return None

            raw_token = self.get_raw_token(header)

            if raw_token is None:
                logger.debug("No token in Authorization header")
                return None

        # Validate the token
        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)

        except InvalidToken as e:
            logger.warning(f"Invalid token (will be ignored): {str(e)}")
            return None

        except Exception as e:
            logger.exception(f"Authentication error: {str(e)}")
            return None

        if token_from_cookie and request.method not in (
            "GET",
            "HEAD",
            "OPTIONS",
            "TRACE",
        ):
            self.enforce_csrf(request)

        logger.debug(f"Successfully authenticated user: {user.email}")
        return (user, validated_token)

    def enforce_csrf(self, request):
        """
        Enforce Django CSRF validation for unsafe cookie-authenticated requests.
        """
        check = CsrfViewMiddleware(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})

        if reason:
            logger.warning("CSRF validation failed for cookie-authenticated request")
            raise exceptions.PermissionDenied(
                "CSRF Failed: CSRF token missing or incorrect."
            )


class ApiTokenAuthentication(BaseAuthentication):
    """
    Authenticate a programmatic client with a personal API token.

    The token travels on the Authorization header, under either scheme:

        Authorization: Bearer dnt_<secret>
        Authorization: Token dnt_<secret>

    Anything not carrying the DevNote token prefix is left alone, so the
    JWT authenticator keeps serving browsers on the very same header.

    Unlike a cookie, a header credential is never attached by the browser on
    its own, so a token request needs no CSRF token.
    """

    SCHEMES = ("bearer", "token")

    def authenticate(self, request):
        raw_token = self.get_raw_token(request)

        if raw_token is None:
            return None

        token = ApiToken.objects.resolve(raw_token)

        if token is None:
            logger.warning("Rejected an unknown API token")
            raise exceptions.AuthenticationFailed("Invalid API token.")

        if token.is_expired():
            logger.warning(f"Rejected expired API token '{token.name}'")
            raise exceptions.AuthenticationFailed("API token has expired.")

        if not token.user.is_active:
            raise exceptions.AuthenticationFailed("User account is inactive.")

        token.touch()
        logger.debug(f"Authenticated {token.user.email} with API token '{token.name}'")

        return (token.user, token)

    def get_raw_token(self, request):
        """The DevNote token on the Authorization header, None if there is none."""
        header = request.META.get("HTTP_AUTHORIZATION", "")

        if isinstance(header, bytes):
            header = header.decode("iso-8859-1")

        parts = header.split()

        if len(parts) != 2 or parts[0].lower() not in self.SCHEMES:
            return None

        return parts[1] if looks_like_api_token(parts[1]) else None

    def authenticate_header(self, request):
        return 'Bearer realm="api"'
