from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User
from .serializers import UserSerializer, RegisterSerializer


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
class LoginView(APIView):
    """
    POST /api/auth/login/
    Authenticates the user and returns a JWT token
    """
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = authenticate(username=username, password=password)

        if user is None:
            return Response(
                {'error': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
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
