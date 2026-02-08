from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from rest_framework.exceptions import ValidationError
import uuid

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    
    Handles user creation with email, password, first_name, last_name.
    Username is optional and auto-generated if not provided.
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        validators=[validate_password],
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        label="Confirm Password"
    )

    class Meta:
        model = User
        fields = ['email', 'username', 'first_name', 'last_name', 'password', 'password2']
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
            'username': {'required': False}
        }

    def validate(self, attrs):
        """Validate that passwords match"""
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs
    
    def create(self, validated_data):
        """
        Creates a new user with a hashed password.
    
        The UserManager automatically handles username generation
        if not provided.

        Args:
            validated_data (dict): Validated data

        Returns:
            User: Instance of the created user
        """
        validated_data.pop('password2')

        user = User.objects.create_user(**validated_data)

        return user


class UserSerializer(serializers.ModelSerializer):
    """
    Serialiser for displaying user information.
    
    Used for:
    - Returning user information after login/registration
    - GET endpoint /api/auth/me/
    
    Excluded fields:
    - password (security: never return the password)
    """

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class LoginSerializer(serializers.Serializer):
    """Serializer for user authentication.
    
    Features:
    - Email-based authentication (since USERNAME_FIELD = 'email')
    - Password validation
    - Returns authenticated user object

    Used by:
    - POST /api/auth/login/
    """

    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, data):
        """
        Authenticates user with email and password.

        Args:
            data (dict): Contains 'email' and 'password'

        Returns:
            dict: Data with authenticated 'user' object

        Raises:
            ValidationError: If credentials are invalid or user is inactive
        """
        
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            raise ValidationError('Email and password are required')
        
        user = authenticate(username=email, password=password)

        if user is None:
            raise ValidationError('Invalid credentials')
        
        if not user.is_active:
            raise ValidationError('User account is disabled')
        
        data['user']= user
        return data
    