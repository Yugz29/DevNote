from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate
from .models import User
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
import logging

logger = logging.getLogger('accounts')


# ============================================
# ENDPOINT : Register
# ============================================
class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Creates a new user and returns their information + JWT tokens
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        response = Response({
            'user': UserSerializer(user).data,
            'message': 'Registration successful'
        }, status=status.HTTP_201_CREATED)

        response.set_cookie(
            key='access_token',
            value=access_token,
            httponly=True,
            secure=False, # permute to True in production (HTTPS)
            samesite='Lax',
            max_age=3600, # 1h like ACCESS_TOKEN_LIFETIME
        )

        response.set_cookie(
            key='refresh_token',
            value=refresh_token,
            httponly=True,
            secure=False, # permute to True in production (?)
            samesite='Lax',
            max_age=604800 # 7 days like REFRESH_TOKEN_LIFETIME
        )

        return response

# ============================================
# ENDPOINT : Login
# ============================================
@method_decorator(ratelimit(key='ip', rate='5/m', method='POST'), name='post')
class LoginView(APIView):
    """
    POST /api/auth/login/
    Authenticates the user and returns a JWT tokens
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"Failed login attempt from IP {request.META.get('REMOTE_ADDR')}: {serializer.errors}")
            serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        logger.info(f"User '{user.username}' logged in successfully")

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response ({
            'user': UserSerializer(user).data,
            'message': 'Logging successful'
        }, status=status.HTTP_200_OK)

        response.set_cookie(
            key='access_token',
            value=access_token,
            httponly=True,
            secure=False,
            samesite='Lax',
            max_age=3600,
        )

        response.set_cookie(
            key='refresh_token',
            value=refresh_token,
            httponly=True,
            secure=False,
            samesite='Lax',
            max_age=604800,
        )

        return response
    
# ============================================
# ENDPOINT : USER DETAILS
# ============================================
class UserDetailView(generics.RetrieveAPIView):
    """
    GET /api/auth/me/
    Returns the logged-in user's information
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user
    
# ============================================
# ENDPOINT : Logout
# ============================================
class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Simple logout
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Confirm logout.
        Deletes cookies and blacklists the refresh token
        """
        try:
            refresh_token = request.COOKIES.get('refresh_token')

            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()

            response = Response(
                {'message': 'Successfully logged out'},
                status=status.HTTP_200_OK
            )

            response.delete_cookie('access_token')
            response.delete_cookie('refresh_token')

            return response
            
        except TokenError as e:
            logger.error(f"Logout error (TokenError): {str(e)}")
                
            response = Response(
                {'message': 'Logged out (token was invalid)'},
                status=status.HTTP_200_OK
            )
            response.delete_cookie('access_token')
            response.delete_cookie('refresh_token')
            return response

        except Exception as e:
            logger.error(f"Unexpected error during logout: {str(e)}")

            response = Response(
                {'message': 'Logged out (with errors)'},
                status=status.HTTP_200_OK
            )
            response.delete_cookie('access_token')
            response.delete_cookie('refresh_token')
            return response

            
# ============================================
# ENDPOINT : Refresh Token
# ============================================
class RefreshView(APIView):
    """
    POST /api/auth/refresh/
    Refreshes the access token using the refresh token from cookies
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            refresh_token = request.COOKIES.get('refresh_token')

            if not refresh_token:
                return Response(
                    {'error': 'Refresh token not found in cookies'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            token = RefreshToken(refresh_token)

            new_access_token = str(token.access_token)

            token.set_jti()
            token.set_exp()
            new_refresh_token = str(token)

            response = Response(
                {'message': 'Token refreshed successfully'},
                status=status.HTTP_200_OK
            )

            response.set_cookie(
                key='access_token',
                value=new_access_token,
                httponly=True,
                secure=False,
                samesite='Lax',
                max_age=3600
            )

            response.set_cookie(
                key='refresh_token',
                value=new_refresh_token,
                httponly=True,
                secure=False,
                samesite='Lax',
                max_age=604800
            )

            return response
        
        except TokenError as e:
            logger.error(f'Token refresh error: {str(e)}')
            return Response(
                {'error': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            logger.error(f"Unexpected error during token refresh: {str(e)}")
            return Response(
                {'error': 'Token refresh failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
