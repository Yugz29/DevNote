from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


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
        fields = ['id', 'username', 'email', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serialiser for registering a new user.
    
    Features:
    - Password validation (length, complexity)
    - Password confirmation (password == password2)
    - Automatic password hashing before saving
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        label="Confirm Password"
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2']

    def validate(self, attrs):
        """
        Custom validation: checks that password == password2
        
        Args:
            attrs (dict): Data validated by DRF
        
        Returns:
            dict: Validated data
        
        Raises:
            ValidationError: If the passwords do not match
        """
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs
    
    def create(self, validated_data):
        """
        Creates a new user with a hashed password.
        
        Args:
            validated_data (dict): Validated data
        
        Returns:
            User: Instance of the created user
        """
        validated_data.pop('password2')

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )

        return user
