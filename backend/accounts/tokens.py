"""Shape, generation and hashing of DevNote personal API tokens."""

import hashlib
import secrets

TOKEN_PREFIX = "dnt_"

SECRET_BYTES = 32

DISPLAY_PREFIX_LENGTH = 8

DEFAULT_EXPIRY_DAYS = 365

MAX_EXPIRY_DAYS = 3650


def generate_token():
    """
    Mint a token. Returns the raw secret, shown to its owner exactly once,
    and the short prefix kept in clear so the owner can tell tokens apart.
    """
    secret = secrets.token_urlsafe(SECRET_BYTES)

    return f"{TOKEN_PREFIX}{secret}", secret[:DISPLAY_PREFIX_LENGTH]


def hash_token(raw_token):
    """
    Digest of a raw token, which is what the database stores.

    A plain SHA-256 is enough here, unlike for a password: the secret is 256
    bits of entropy drawn from the system CSPRNG, so it cannot be guessed and
    a slow KDF would only tax every authenticated request.
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def looks_like_api_token(value):
    """
    Whether a credential is one of ours, so the JWT authenticator keeps
    handling everything else presented on the same header.
    """
    return bool(value) and value.startswith(TOKEN_PREFIX)
