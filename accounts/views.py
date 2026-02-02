from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
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
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)

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

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)
    
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
        The client must delete their tokens (access + refresh).
        """
        return Response(
            {'message': 'Successfully logged out. Clear tokens on client side.'},
            status=status.HTTP_200_OK
        )
