from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate, get_user_model
from .models import User

UserModel = get_user_model()
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer
from .cookie_utils import set_auth_cookies, delete_auth_cookies, get_token_from_cookie
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from django.conf import settings
import logging

logger = logging.getLogger('accounts')


# ============================================
# ENDPOINT : Register
# ============================================
@method_decorator(ratelimit(key='ip', rate='3/m', method='POST'), name='post')
class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Creates a new user and returns their information + JWT tokens
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        if getattr(request, 'limited', False):
            return Response(
                {'error': 'Too many registration attempts. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
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

        set_auth_cookies(response, access_token, refresh_token)

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
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data['user']

        logger.info(f"User '{user.username}' logged in successfully")

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response ({
            'user': UserSerializer(user).data,
            'message': 'Logging successful'
        }, status=status.HTTP_200_OK)

        set_auth_cookies(response, access_token, refresh_token)

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

            delete_auth_cookies(response)

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
            refresh_token_str = request.COOKIES.get('refresh_token')

            if not refresh_token_str:
                return Response(
                    {'error': 'Refresh token not found in cookies'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # Valider et blacklister l'ancien refresh token
            old_token = RefreshToken(refresh_token_str)
            old_token.blacklist()  # ✅ Invalide l'ancien token (empêche la réutilisation)

            # Récupérer l'utilisateur depuis le payload du token
            user_id = old_token.payload.get('user_id')
            user = UserModel.objects.get(id=user_id)

            # Générer une nouvelle paire de tokens propre
            new_token = RefreshToken.for_user(user)
            new_access_token = str(new_token.access_token)
            new_refresh_token = str(new_token)

            response = Response(
                {'message': 'Token refreshed successfully'},
                status=status.HTTP_200_OK
            )

            set_auth_cookies(response, new_access_token, new_refresh_token)
            logger.info(f'Token refreshed for user {user.email}')
            return response

        except TokenError as e:
            logger.warning(f'Token refresh failed (invalid token): {str(e)}')
            return Response(
                {'error': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except UserModel.DoesNotExist:
            logger.error('Token refresh failed: user not found')
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            logger.error(f"Unexpected error during token refresh: {str(e)}")
            return Response(
                {'error': 'Token refresh failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
