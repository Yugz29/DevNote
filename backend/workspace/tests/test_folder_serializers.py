from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase

from workspace.models import Document, Folder, Project
from workspace.serializers import DocumentSerializer, FolderSerializer

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
                "resource_type",
                "project_id",
                "parent",
                "folder_count",
                "document_count",
                "snippet_count",
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


class DocumentFolderSerializerTest(TestCase):
    """Tests for the folder field on DocumentSerializer"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="notefolderserializer",
            email="notefolderserializer@test.com",
            password="TestPass123!",
        )
        self.project = Project.objects.create(
            title="Document Folder Project", user=self.user
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

        return DocumentSerializer(instance=instance, **kwargs)

    def test_document_without_folder_still_valid(self):
        """Test backward compatibility of the existing payload shape"""
        serializer = self.get_serializer(
            data={"title": "Loose document", "content": "Body"}, project=self.project
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        document = serializer.save(project=self.project)

        self.assertIsNone(document.folder)

    def test_document_created_in_folder(self):
        """Test creating a document directly inside a folder"""
        serializer = self.get_serializer(
            data={"title": "Filed document", "folder": str(self.folder.id)},
            project=self.project,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        document = serializer.save(project=self.project)

        self.assertEqual(document.folder, self.folder)

    def test_folder_exposed_in_payload(self):
        """Test that the folder id is serialized"""
        document = Document.objects.create(
            title="Filed document", project=self.project, folder=self.folder
        )
        data = self.get_serializer(instance=document).data

        self.assertEqual(data["folder"], self.folder.id)

    def test_folder_from_another_project_rejected(self):
        """Test that a folder in another project is rejected"""
        other_project = Project.objects.create(title="Other Project", user=self.user)
        foreign = Folder.objects.create(name="Foreign", project=other_project)

        serializer = self.get_serializer(
            data={"title": "Document", "folder": str(foreign.id)}, project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("folder", serializer.errors)

    def test_document_moved_back_to_root(self):
        """Test detaching a document from its folder"""
        document = Document.objects.create(
            title="Filed document", project=self.project, folder=self.folder
        )

        serializer = self.get_serializer(
            data={"folder": None}, instance=document, partial=True
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()

        self.assertIsNone(updated.folder)


class TypedFolderSerializerTest(TestCase):
    """Tests for the resource type through the folder serializer"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="typedfolderserializeruser",
            email="typedfolderserializer@test.com",
            password="TestPass123!",
        )
        self.project = Project.objects.create(
            title="Typed Serializer Project", user=self.user
        )

    def get_serializer(self, data=None, instance=None, project=None, partial=False):
        mock_request = SimpleNamespace(user=self.user)
        context = {"request": mock_request}

        if project is not None:
            context["project"] = project

        kwargs = {"context": context, "partial": partial}

        if data is not None:
            kwargs["data"] = data

        return FolderSerializer(instance=instance, **kwargs)

    def test_create_snippet_folder(self):
        """Test creating a snippet folder through the serializer"""
        serializer = self.get_serializer(
            data={"name": "Helpers", "resource_type": "snippets"},
            project=self.project,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        folder = serializer.save(project=self.project)

        self.assertEqual(folder.resource_type, "snippets")

    def test_unknown_resource_type_rejected(self):
        """Test that only the known resource types are accepted"""
        serializer = self.get_serializer(
            data={"name": "Helpers", "resource_type": "todos"}, project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("resource_type", serializer.errors)

    def test_resource_type_cannot_change(self):
        """Test that a folder keeps the kind of resource it was created for"""
        folder = Folder.objects.create(name="Archives", project=self.project)

        serializer = self.get_serializer(
            data={"resource_type": "snippets"}, instance=folder, partial=True
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("resource_type", serializer.errors)

    def test_unchanged_resource_type_accepted(self):
        """Test that resending the current type is not treated as a change"""
        folder = Folder.objects.create(name="Archives", project=self.project)

        serializer = self.get_serializer(
            data={"name": "Renamed", "resource_type": "documents"},
            instance=folder,
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_parent_of_another_type_rejected(self):
        """Test that the serializer refuses to mix types in a branch"""
        parent = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )

        serializer = self.get_serializer(
            data={"name": "Child", "parent": str(parent.id)}, project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("parent", serializer.errors)

    def test_same_name_allowed_across_types_at_root(self):
        """Test that the name collision check is scoped to one type"""
        Folder.objects.create(name="Utils", project=self.project)

        serializer = self.get_serializer(
            data={"name": "Utils", "resource_type": "snippets"}, project=self.project
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_same_name_rejected_within_a_type(self):
        """Test that the name collision check still applies inside a type"""
        Folder.objects.create(
            name="Utils", project=self.project, resource_type="snippets"
        )

        serializer = self.get_serializer(
            data={"name": "Utils", "resource_type": "snippets"}, project=self.project
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_document_rejected_in_a_snippet_folder(self):
        """Test that a document cannot land in a folder holding snippets"""
        folder = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )

        serializer = DocumentSerializer(
            data={"title": "Notes", "folder": str(folder.id)},
            context={
                "request": SimpleNamespace(user=self.user),
                "project": self.project,
            },
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("folder", serializer.errors)
