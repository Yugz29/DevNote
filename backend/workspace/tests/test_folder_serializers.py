from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase

from workspace.models import Folder, Note, Project
from workspace.serializers import FolderSerializer, NoteSerializer

User = get_user_model()


class FolderSerializerTest(TestCase):
    def setUp(self):
        """Set up a user, a project and a folder for testing"""
        self.user = User.objects.create_user(
            username="folderserializeruser",
            email="folderserializer@test.com",
            password="TestPass123!",
        )
        self.project = Project.objects.create(
            title="Serializer Project", user=self.user
        )
        self.folder = Folder.objects.create(name="Archives", project=self.project)

    def get_serializer(self, data=None, instance=None, project=None, partial=False):
        """Helper to get serializer with context"""
        mock_request = SimpleNamespace(user=self.user)
        context = {"request": mock_request}

        if project is not None:
            context["project"] = project

        kwargs = {"context": context, "partial": partial}

        if data is not None:
            kwargs["data"] = data

        return FolderSerializer(instance=instance, **kwargs)

    def test_valid_folder_data(self):
        """Test serializer with valid data"""
        serializer = self.get_serializer(data={"name": "Drafts"}, project=self.project)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        folder = serializer.save(project=self.project)

        self.assertEqual(folder.name, "Drafts")
        self.assertIsNone(folder.parent)

    def test_name_is_stripped(self):
        """Test that surrounding whitespace is removed from the name"""
        serializer = self.get_serializer(
            data={"name": "  Drafts  "}, project=self.project
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["name"], "Drafts")

    def test_blank_name_rejected(self):
        """Test that a whitespace-only name is rejected"""
        serializer = self.get_serializer(data={"name": "   "}, project=self.project)

        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_duplicate_name_rejected(self):
        """Test that a duplicate name at the same level is rejected"""
        serializer = self.get_serializer(
            data={"name": "Archives"}, project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_serialized_fields(self):
        """Test the shape of the serialized payload"""
        data = self.get_serializer(instance=self.folder).data

        self.assertEqual(
            set(data.keys()),
            {
                "id",
                "name",
                "project_id",
                "parent",
                "folder_count",
                "note_count",
                "created_at",
                "updated_at",
            },
        )
        self.assertEqual(data["project_id"], str(self.project.id))
        self.assertIsNone(data["parent"])

    def test_self_parent_rejected(self):
        """Test that a folder cannot be moved into itself"""
        serializer = self.get_serializer(
            data={"parent": str(self.folder.id)}, instance=self.folder, partial=True
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("parent", serializer.errors)

    def test_descendant_parent_rejected(self):
        """Test that a folder cannot be moved into its own descendant"""
        child = Folder.objects.create(
            name="Child", project=self.project, parent=self.folder
        )
        grandchild = Folder.objects.create(
            name="Grandchild", project=self.project, parent=child
        )

        serializer = self.get_serializer(
            data={"parent": str(grandchild.id)}, instance=self.folder, partial=True
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("parent", serializer.errors)

    def test_parent_from_another_project_rejected(self):
        """Test that a parent in another project is rejected"""
        other_project = Project.objects.create(title="Other Project", user=self.user)
        foreign = Folder.objects.create(name="Foreign", project=other_project)

        serializer = self.get_serializer(
            data={"name": "Child", "parent": str(foreign.id)}, project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("parent", serializer.errors)

    def test_parent_of_another_user_rejected(self):
        """Test that another user's folder cannot be used as parent"""
        other_user = User.objects.create_user(
            username="otherfolderuser",
            email="otherfolder@test.com",
            password="TestPass123!",
        )
        other_project = Project.objects.create(title="Foreign Project", user=other_user)
        foreign = Folder.objects.create(name="Foreign", project=other_project)

        serializer = self.get_serializer(
            data={"name": "Child", "parent": str(foreign.id)}, project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("parent", serializer.errors)

    def test_move_to_valid_parent(self):
        """Test moving a folder under another folder"""
        target = Folder.objects.create(name="Target", project=self.project)

        serializer = self.get_serializer(
            data={"parent": str(target.id)}, instance=self.folder, partial=True
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        folder = serializer.save()

        self.assertEqual(folder.parent, target)


class NoteFolderSerializerTest(TestCase):
    """Tests for the folder field on NoteSerializer"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="notefolderserializer",
            email="notefolderserializer@test.com",
            password="TestPass123!",
        )
        self.project = Project.objects.create(
            title="Note Folder Project", user=self.user
        )
        self.folder = Folder.objects.create(name="Archives", project=self.project)

    def get_serializer(self, data=None, instance=None, project=None, partial=False):
        mock_request = SimpleNamespace(user=self.user)
        context = {"request": mock_request}

        if project is not None:
            context["project"] = project

        kwargs = {"context": context, "partial": partial}

        if data is not None:
            kwargs["data"] = data

        return NoteSerializer(instance=instance, **kwargs)

    def test_note_without_folder_still_valid(self):
        """Test backward compatibility of the existing payload shape"""
        serializer = self.get_serializer(
            data={"title": "Loose note", "content": "Body"}, project=self.project
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        note = serializer.save(project=self.project)

        self.assertIsNone(note.folder)

    def test_note_created_in_folder(self):
        """Test creating a note directly inside a folder"""
        serializer = self.get_serializer(
            data={"title": "Filed note", "folder": str(self.folder.id)},
            project=self.project,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        note = serializer.save(project=self.project)

        self.assertEqual(note.folder, self.folder)

    def test_folder_exposed_in_payload(self):
        """Test that the folder id is serialized"""
        note = Note.objects.create(
            title="Filed note", project=self.project, folder=self.folder
        )
        data = self.get_serializer(instance=note).data

        self.assertEqual(data["folder"], self.folder.id)

    def test_folder_from_another_project_rejected(self):
        """Test that a folder in another project is rejected"""
        other_project = Project.objects.create(title="Other Project", user=self.user)
        foreign = Folder.objects.create(name="Foreign", project=other_project)

        serializer = self.get_serializer(
            data={"title": "Note", "folder": str(foreign.id)}, project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("folder", serializer.errors)

    def test_note_moved_back_to_root(self):
        """Test detaching a note from its folder"""
        note = Note.objects.create(
            title="Filed note", project=self.project, folder=self.folder
        )

        serializer = self.get_serializer(
            data={"folder": None}, instance=note, partial=True
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()

        self.assertIsNone(updated.folder)
