"""
Custom JWT Authentication for DevNote
Supports both cookie-based and header-based authentication
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.conf import settings
import logging

logger = logging.getLogger('accounts')


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
        cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
        raw_token = request.COOKIES.get(cookie_name)
        
        if raw_token:
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
            
            logger.debug(f"Successfully authenticated user: {user.email}")
            return (user, validated_token)
            
        except InvalidToken as e:
            logger.warning(f"Invalid token (will be ignored): {str(e)}")
            return None
        
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return None
