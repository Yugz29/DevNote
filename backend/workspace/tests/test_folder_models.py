from uuid import UUID

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from workspace.models import Document, Folder, Project, Snippet

User = get_user_model()


class FolderModelTest(TestCase):
    """Tests for the Folder model"""

    def setUp(self):
        """Preparation: create a test user and a project"""
        self.user = User.objects.create_user(
            username="foldertestuser", email="folder@test.com", password="TestPass123!"
        )
        self.project = Project.objects.create(
            title="Folder Test Project",
            description="A project for folder testing.",
            user=self.user,
        )

    def test_create_root_folder(self):
        """Test creating a folder at the project root"""
        folder = Folder.objects.create(name="Archives", project=self.project)

        self.assertEqual(folder.name, "Archives")
        self.assertEqual(folder.project, self.project)
        self.assertIsNone(folder.parent)
        self.assertIsNotNone(folder.created_at)
        self.assertIsNotNone(folder.updated_at)
        self.assertIsInstance(folder.id, UUID)

    def test_create_nested_folder(self):
        """Test creating a folder inside another folder"""
        parent = Folder.objects.create(name="Parent", project=self.project)
        child = Folder.objects.create(name="Child", project=self.project, parent=parent)

        self.assertEqual(child.parent, parent)
        self.assertIn(child, parent.children.all())

    def test_unlimited_nesting_depth(self):
        """Test that folders nest without a depth limit"""
        current = None
        created = []

        for index in range(10):
            current = Folder.objects.create(
                name=f"Level {index}", project=self.project, parent=current
            )
            created.append(current)

        deepest = created[-1]
        self.assertEqual(len(deepest.ancestor_ids()), 9)
        self.assertEqual(deepest.ancestor_ids()[0], created[-2].id)
        self.assertEqual(deepest.ancestor_ids()[-1], created[0].id)

    def test_str_returns_name(self):
        """Test the string representation of a folder"""
        folder = Folder.objects.create(name="Docs", project=self.project)
        self.assertEqual(str(folder), "Docs")

    def test_ordering_is_alphabetical(self):
        """Test that folders are ordered by name"""
        Folder.objects.create(name="Zulu", project=self.project)
        Folder.objects.create(name="Alpha", project=self.project)
        Folder.objects.create(name="Mike", project=self.project)

        names = list(Folder.objects.values_list("name", flat=True))
        self.assertEqual(names, ["Alpha", "Mike", "Zulu"])

    def test_folder_cannot_be_its_own_parent(self):
        """Test that a folder cannot reference itself as parent"""
        folder = Folder.objects.create(name="Loop", project=self.project)
        folder.parent = folder

        with self.assertRaises(ValidationError):
            folder.save()

    def test_folder_cannot_be_its_own_ancestor(self):
        """Test that a cycle deeper in the tree is rejected"""
        grandparent = Folder.objects.create(name="A", project=self.project)
        parent = Folder.objects.create(
            name="B", project=self.project, parent=grandparent
        )
        child = Folder.objects.create(name="C", project=self.project, parent=parent)

        grandparent.parent = child

        with self.assertRaises(ValidationError):
            grandparent.save()

    def test_parent_must_belong_to_same_project(self):
        """Test that a parent from another project is rejected"""
        other_project = Project.objects.create(title="Other Project", user=self.user)
        foreign_parent = Folder.objects.create(name="Foreign", project=other_project)

        folder = Folder(name="Child", project=self.project, parent=foreign_parent)

        with self.assertRaises(ValidationError):
            folder.save()

    def test_unique_name_at_root(self):
        """Test that two root folders cannot share a name in a project"""
        Folder.objects.create(name="Archives", project=self.project)

        with self.assertRaises(ValidationError):
            Folder.objects.create(name="Archives", project=self.project)

    def test_unique_name_in_same_parent(self):
        """Test that two siblings cannot share a name"""
        parent = Folder.objects.create(name="Parent", project=self.project)
        Folder.objects.create(name="Docs", project=self.project, parent=parent)

        with self.assertRaises(ValidationError):
            Folder.objects.create(name="Docs", project=self.project, parent=parent)

    def test_same_name_allowed_in_different_parents(self):
        """Test that the same name is fine under different parents"""
        first = Folder.objects.create(name="First", project=self.project)
        second = Folder.objects.create(name="Second", project=self.project)

        Folder.objects.create(name="Docs", project=self.project, parent=first)
        Folder.objects.create(name="Docs", project=self.project, parent=second)

        self.assertEqual(Folder.objects.filter(name="Docs").count(), 2)

    def test_same_name_allowed_in_different_projects(self):
        """Test that the same root name is fine across projects"""
        other_project = Project.objects.create(title="Other Project", user=self.user)

        Folder.objects.create(name="Archives", project=self.project)
        Folder.objects.create(name="Archives", project=other_project)

        self.assertEqual(Folder.objects.filter(name="Archives").count(), 2)

    def test_delete_project_cascades_to_folders(self):
        """Test that deleting a project deletes its folders"""
        Folder.objects.create(name="Archives", project=self.project)

        self.assertEqual(Folder.objects.count(), 1)
        self.project.delete()
        self.assertEqual(Folder.objects.count(), 0)

    def test_delete_folder_cascades_to_subfolders_and_documents(self):
        """Test that deleting a folder deletes its whole subtree"""
        root = Folder.objects.create(name="Root", project=self.project)
        child = Folder.objects.create(name="Child", project=self.project, parent=root)
        Document.objects.create(
            title="Nested document", project=self.project, folder=child
        )
        Document.objects.create(
            title="Direct document", project=self.project, folder=root
        )
        kept = Document.objects.create(title="Root document", project=self.project)

        root.delete()

        self.assertEqual(Folder.objects.count(), 0)
        self.assertEqual(Document.objects.count(), 1)
        self.assertEqual(Document.objects.first().id, kept.id)

    def test_cascade_counts(self):
        """Test the counts reported before a recursive delete"""
        root = Folder.objects.create(name="Root", project=self.project)
        child = Folder.objects.create(name="Child", project=self.project, parent=root)
        Folder.objects.create(name="Grandchild", project=self.project, parent=child)
        Document.objects.create(title="One", project=self.project, folder=root)
        Document.objects.create(title="Two", project=self.project, folder=child)
        Document.objects.create(title="Loose", project=self.project)

        counts = root.cascade_counts()

        self.assertEqual(counts["folders"], 2)
        self.assertEqual(counts["documents"], 2)
        self.assertFalse(root.is_empty())

    def test_empty_folder(self):
        """Test that a folder without children or documents reports as empty"""
        folder = Folder.objects.create(name="Empty", project=self.project)

        self.assertTrue(folder.is_empty())
        self.assertEqual(
            folder.cascade_counts(),
            {"folders": 0, "documents": 0, "snippets": 0},
        )


class DocumentFolderFieldTest(TestCase):
    """Tests for the folder field added to Document"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="notefolderuser",
            email="notefolder@test.com",
            password="TestPass123!",
        )
        self.project = Project.objects.create(
            title="Document Folder Project", user=self.user
        )
        self.folder = Folder.objects.create(name="Archives", project=self.project)

    def test_document_defaults_to_root(self):
        """Test that a document created without a folder sits at the root"""
        document = Document.objects.create(title="Loose document", project=self.project)
        self.assertIsNone(document.folder)

    def test_document_inside_folder(self):
        """Test attaching a document to a folder"""
        document = Document.objects.create(
            title="Filed document", project=self.project, folder=self.folder
        )

        self.assertEqual(document.folder, self.folder)
        self.assertIn(document, self.folder.documents.all())

    def test_existing_documents_remain_valid_without_folder(self):
        """Test backward compatibility: documents without a folder stay usable"""
        document = Document.objects.create(
            title="Legacy document", project=self.project
        )

        document.content = "Updated content"
        document.save()
        document.refresh_from_db()

        self.assertIsNone(document.folder)
        self.assertEqual(document.content, "Updated content")
        self.assertIn(document, self.project.documents.all())


class TypedFolderModelTest(TestCase):
    """Tests for the resource type carried by a folder"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="typedfolderuser",
            email="typedfolder@test.com",
            password="TestPass123!",
        )
        self.project = Project.objects.create(
            title="Typed Folder Project", user=self.user
        )

    def test_folder_holds_documents_by_default(self):
        """Test that a folder created without a type holds documents"""
        folder = Folder.objects.create(name="Archives", project=self.project)

        self.assertEqual(folder.resource_type, "documents")

    def test_create_snippet_folder(self):
        """Test creating a folder holding snippets"""
        folder = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )

        self.assertEqual(folder.resource_type, "snippets")

    def test_parent_of_another_type_rejected(self):
        """Test that a branch cannot mix documents and snippets"""
        parent = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )

        with self.assertRaises(ValidationError) as context:
            Folder.objects.create(name="Child", project=self.project, parent=parent)

        self.assertIn("parent", context.exception.message_dict)

    def test_same_name_allowed_across_types_at_root(self):
        """Test that each type has its own root namespace"""
        documents = Folder.objects.create(name="Utils", project=self.project)
        snippets = Folder.objects.create(
            name="Utils", project=self.project, resource_type="snippets"
        )

        self.assertNotEqual(documents.id, snippets.id)
        self.assertEqual(
            Folder.objects.filter(project=self.project, name="Utils").count(), 2
        )

    def test_same_name_still_rejected_within_a_type(self):
        """Test that the root namespace of a type stays unique"""
        Folder.objects.create(
            name="Utils", project=self.project, resource_type="snippets"
        )

        with self.assertRaises(ValidationError):
            Folder.objects.create(
                name="Utils", project=self.project, resource_type="snippets"
            )

    def test_cascade_counts_of_a_snippet_folder(self):
        """Test that a snippet folder counts snippets, never documents"""
        folder = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )
        child = Folder.objects.create(
            name="Nested",
            project=self.project,
            parent=folder,
            resource_type="snippets",
        )
        Snippet.objects.create(
            title="Root snippet",
            content="pass",
            project=self.project,
            folder=folder,
        )
        Snippet.objects.create(
            title="Nested snippet",
            content="pass",
            project=self.project,
            folder=child,
        )

        self.assertEqual(
            folder.cascade_counts(),
            {"folders": 1, "documents": 0, "snippets": 2},
        )
        self.assertFalse(folder.is_empty())

    def test_deleting_a_snippet_folder_cascades_to_its_snippets(self):
        """Test that snippets go with the folder holding them"""
        folder = Folder.objects.create(
            name="Helpers", project=self.project, resource_type="snippets"
        )
        Snippet.objects.create(
            title="Doomed", content="pass", project=self.project, folder=folder
        )

        folder.delete()

        self.assertEqual(Snippet.objects.count(), 0)

    def test_snippet_at_root_has_no_folder(self):
        """Test that a snippet created without a folder sits at the root"""
        snippet = Snippet.objects.create(
            title="Loose", content="pass", project=self.project
        )

        self.assertIsNone(snippet.folder)
