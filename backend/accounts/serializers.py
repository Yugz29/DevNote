from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

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
        style={"input_type": "password"},
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        label="Confirm Password",
    )

    class Meta:
        model = User
        fields = [
            "email",
            "username",
            "first_name",
            "last_name",
            "password",
            "password2",
        ]
        extra_kwargs = {
            "email": {"required": True},
            "first_name": {"required": True},
            "last_name": {"required": True},
            "username": {"required": False},
        }

    def validate(self, attrs):
        """
        Validates the password against the project validators, then
        checks that both password fields match.

        The validators run against an unsaved user carrying the submitted
        identity, so a password too close to the email or the name is
        caught before the account exists.
        """
        candidate = User(
            email=attrs.get("email"),
            username=attrs.get("username"),
            first_name=attrs.get("first_name"),
            last_name=attrs.get("last_name"),
        )

        try:
            validate_password(attrs["password"], candidate)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": list(error.messages)})

        if attrs["password"] != attrs["password2"]:
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
        validated_data.pop("password2")

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
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


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

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            raise ValidationError("Email and password are required")

        user = authenticate(username=email, password=password)

        if user is None:
            raise ValidationError("Invalid credentials")

        if not user.is_active:
            raise ValidationError("User account is disabled")

        data["user"] = user
        return data


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing the password of the logged-in user.

    Features:
    - Verifies the current password before accepting anything
    - Runs the project password validators against the new one
    - Refuses a new password identical to the current one

    Used by:
    - POST /api/auth/password/
    """

    current_password = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )
    new_password = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )
    new_password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        label="Confirm New Password",
    )

    def validate_current_password(self, value):
        """
        Checks the submitted password against the stored hash.

        Raises:
            ValidationError: If it does not match
        """
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        """Runs the configured password validators against the new password"""
        validate_password(value, self.context["request"].user)
        return value

    def validate(self, attrs):
        """Validates that the new password is confirmed and actually new"""
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError(
                {"new_password": "Password fields didn't match."}
            )

        if attrs["new_password"] == attrs["current_password"]:
            raise serializers.ValidationError(
                {"new_password": "The new password must differ from the current one."}
            )

        return attrs

    def save(self, **kwargs):
        """
        Hashes and stores the new password.

        Returns:
            User: The updated user
        """
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])
        return user


class DeleteAccountSerializer(serializers.Serializer):
    """Serializer guarding the deletion of the logged-in user's account.

    Features:
    - Requires the current password, so the deletion cannot be triggered
      by a stray click or by someone borrowing an open session

    Used by:
    - DELETE /api/auth/account/
    """

    current_password = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )

    def validate_current_password(self, value):
        """
        Checks the submitted password against the stored hash.

        Raises:
            ValidationError: If it does not match
        """
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
