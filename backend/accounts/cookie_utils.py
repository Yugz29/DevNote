"""
Helper functions for cookie management in DevNote authentication
"""

from django.conf import settings


def set_auth_cookies(response, access_token, refresh_token):
    """
    Set authentication cookies (access_token and refresh_token) on the response.
    
    Uses configuration from settings.SIMPLE_JWT to ensure consistency.
    Automatically adjusts secure flag based on DEBUG setting.
    
    Args:
        response: Django Response object
        access_token (str): JWT access token
        refresh_token (str): JWT refresh token
    
    Returns:
        None (modifies response in place)
    
    Example:
        >>> response = Response({'message': 'Login successful'})
        >>> set_auth_cookies(response, access_token_str, refresh_token_str)
    """
    
    jwt_settings = settings.SIMPLE_JWT
    
    # Determine if we're in production (secure cookies require HTTPS)
    is_secure = jwt_settings.get('AUTH_COOKIE_SECURE', not settings.DEBUG)
    
    # Get cookie names from settings
    access_cookie_name = jwt_settings.get('AUTH_COOKIE', 'access_token')
    refresh_cookie_name = jwt_settings.get('AUTH_COOKIE_REFRESH', 'refresh_token')
    
    # Set Access Token Cookie
    response.set_cookie(
        key=access_cookie_name,
        value=access_token,
        max_age=int(jwt_settings['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        httponly=jwt_settings.get('AUTH_COOKIE_HTTP_ONLY', True),
        secure=is_secure,
        samesite=jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax'),
        path=jwt_settings.get('AUTH_COOKIE_PATH', '/'),
    )
    
    # Set Refresh Token Cookie
    response.set_cookie(
        key=refresh_cookie_name,
        value=refresh_token,
        max_age=int(jwt_settings['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=jwt_settings.get('AUTH_COOKIE_HTTP_ONLY', True),
        secure=is_secure,
        samesite=jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax'),
        path=jwt_settings.get('AUTH_COOKIE_PATH', '/'),
    )


def delete_auth_cookies(response):
    """
    Delete authentication cookies from the response.
    
    Used during logout to clear the user's session.
    
    Args:
        response: Django Response object
    
    Returns:
        None (modifies response in place)
    
    Example:
        >>> response = Response({'message': 'Logged out'})
        >>> delete_auth_cookies(response)
    """
    
    jwt_settings = settings.SIMPLE_JWT
    
    # Get cookie names from settings
    access_cookie_name = jwt_settings.get('AUTH_COOKIE', 'access_token')
    refresh_cookie_name = jwt_settings.get('AUTH_COOKIE_REFRESH', 'refresh_token')
    
    # Delete cookies by setting them with max_age=0
    response.delete_cookie(access_cookie_name, path='/')
    response.delete_cookie(refresh_cookie_name, path='/')


def get_token_from_cookie(request, token_type='access'):
    """
    Extract JWT token from request cookies.
    
    Args:
        request: Django Request object
        token_type (str): Either 'access' or 'refresh'
    
    Returns:
        str: Token value if found, None otherwise
    
    Example:
        >>> access_token = get_token_from_cookie(request, 'access')
        >>> refresh_token = get_token_from_cookie(request, 'refresh')
    """
    
    jwt_settings = settings.SIMPLE_JWT
    
    if token_type == 'access':
        cookie_name = jwt_settings.get('AUTH_COOKIE', 'access_token')
    elif token_type == 'refresh':
        cookie_name = jwt_settings.get('AUTH_COOKIE_REFRESH', 'refresh_token')
    else:
        raise ValueError("token_type must be either 'access' or 'refresh'")
    
    return request.COOKIES.get(cookie_name)
