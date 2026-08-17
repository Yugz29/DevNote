from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from workspace.models import Folder, Note, Project
from uuid import UUID

User = get_user_model()


class FolderModelTest(TestCase):
    """Tests for the Folder model"""

    def setUp(self):
        """Preparation: create a test user and a project"""
        self.user = User.objects.create_user(
            username='foldertestuser',
            email='folder@test.com',
            password='TestPass123!'
        )
        self.project = Project.objects.create(
            title='Folder Test Project',
            description='A project for folder testing.',
            user=self.user
        )

    def test_create_root_folder(self):
        """Test creating a folder at the project root"""
        folder = Folder.objects.create(name='Archives', project=self.project)

        self.assertEqual(folder.name, 'Archives')
        self.assertEqual(folder.project, self.project)
        self.assertIsNone(folder.parent)
        self.assertIsNotNone(folder.created_at)
        self.assertIsNotNone(folder.updated_at)
        self.assertIsInstance(folder.id, UUID)

    def test_create_nested_folder(self):
        """Test creating a folder inside another folder"""
        parent = Folder.objects.create(name='Parent', project=self.project)
        child = Folder.objects.create(
            name='Child',
            project=self.project,
            parent=parent
        )

        self.assertEqual(child.parent, parent)
        self.assertIn(child, parent.children.all())

    def test_unlimited_nesting_depth(self):
        """Test that folders nest without a depth limit"""
        current = None
        created = []

        for index in range(10):
            current = Folder.objects.create(
                name=f'Level {index}',
                project=self.project,
                parent=current
            )
            created.append(current)

        deepest = created[-1]
        self.assertEqual(len(deepest.ancestor_ids()), 9)
        self.assertEqual(deepest.ancestor_ids()[0], created[-2].id)
        self.assertEqual(deepest.ancestor_ids()[-1], created[0].id)

    def test_str_returns_name(self):
        """Test the string representation of a folder"""
        folder = Folder.objects.create(name='Docs', project=self.project)
        self.assertEqual(str(folder), 'Docs')

    def test_ordering_is_alphabetical(self):
        """Test that folders are ordered by name"""
        Folder.objects.create(name='Zulu', project=self.project)
        Folder.objects.create(name='Alpha', project=self.project)
        Folder.objects.create(name='Mike', project=self.project)

        names = list(Folder.objects.values_list('name', flat=True))
        self.assertEqual(names, ['Alpha', 'Mike', 'Zulu'])

    def test_folder_cannot_be_its_own_parent(self):
        """Test that a folder cannot reference itself as parent"""
        folder = Folder.objects.create(name='Loop', project=self.project)
        folder.parent = folder

        with self.assertRaises(ValidationError):
            folder.save()

    def test_folder_cannot_be_its_own_ancestor(self):
        """Test that a cycle deeper in the tree is rejected"""
        grandparent = Folder.objects.create(name='A', project=self.project)
        parent = Folder.objects.create(
            name='B', project=self.project, parent=grandparent
        )
        child = Folder.objects.create(
            name='C', project=self.project, parent=parent
        )

        grandparent.parent = child

        with self.assertRaises(ValidationError):
            grandparent.save()

    def test_parent_must_belong_to_same_project(self):
        """Test that a parent from another project is rejected"""
        other_project = Project.objects.create(
            title='Other Project',
            user=self.user
        )
        foreign_parent = Folder.objects.create(
            name='Foreign',
            project=other_project
        )

        folder = Folder(
            name='Child',
            project=self.project,
            parent=foreign_parent
        )

        with self.assertRaises(ValidationError):
            folder.save()

    def test_unique_name_at_root(self):
        """Test that two root folders cannot share a name in a project"""
        Folder.objects.create(name='Archives', project=self.project)

        with self.assertRaises(ValidationError):
            Folder.objects.create(name='Archives', project=self.project)

    def test_unique_name_in_same_parent(self):
        """Test that two siblings cannot share a name"""
        parent = Folder.objects.create(name='Parent', project=self.project)
        Folder.objects.create(name='Docs', project=self.project, parent=parent)

        with self.assertRaises(ValidationError):
            Folder.objects.create(
                name='Docs', project=self.project, parent=parent
            )

    def test_same_name_allowed_in_different_parents(self):
        """Test that the same name is fine under different parents"""
        first = Folder.objects.create(name='First', project=self.project)
        second = Folder.objects.create(name='Second', project=self.project)

        Folder.objects.create(name='Docs', project=self.project, parent=first)
        Folder.objects.create(name='Docs', project=self.project, parent=second)

        self.assertEqual(Folder.objects.filter(name='Docs').count(), 2)

    def test_same_name_allowed_in_different_projects(self):
        """Test that the same root name is fine across projects"""
        other_project = Project.objects.create(
            title='Other Project',
            user=self.user
        )

        Folder.objects.create(name='Archives', project=self.project)
        Folder.objects.create(name='Archives', project=other_project)

        self.assertEqual(Folder.objects.filter(name='Archives').count(), 2)

    def test_delete_project_cascades_to_folders(self):
        """Test that deleting a project deletes its folders"""
        Folder.objects.create(name='Archives', project=self.project)

        self.assertEqual(Folder.objects.count(), 1)
        self.project.delete()
        self.assertEqual(Folder.objects.count(), 0)

    def test_delete_folder_cascades_to_subfolders_and_notes(self):
        """Test that deleting a folder deletes its whole subtree"""
        root = Folder.objects.create(name='Root', project=self.project)
        child = Folder.objects.create(
            name='Child', project=self.project, parent=root
        )
        Note.objects.create(
            title='Nested note', project=self.project, folder=child
        )
        Note.objects.create(
            title='Direct note', project=self.project, folder=root
        )
        kept = Note.objects.create(title='Root note', project=self.project)

        root.delete()

        self.assertEqual(Folder.objects.count(), 0)
        self.assertEqual(Note.objects.count(), 1)
        self.assertEqual(Note.objects.first().id, kept.id)

    def test_cascade_counts(self):
        """Test the counts reported before a recursive delete"""
        root = Folder.objects.create(name='Root', project=self.project)
        child = Folder.objects.create(
            name='Child', project=self.project, parent=root
        )
        Folder.objects.create(
            name='Grandchild', project=self.project, parent=child
        )
        Note.objects.create(title='One', project=self.project, folder=root)
        Note.objects.create(title='Two', project=self.project, folder=child)
        Note.objects.create(title='Loose', project=self.project)

        counts = root.cascade_counts()

        self.assertEqual(counts['folders'], 2)
        self.assertEqual(counts['notes'], 2)
        self.assertFalse(root.is_empty())

    def test_empty_folder(self):
        """Test that a folder without children or notes reports as empty"""
        folder = Folder.objects.create(name='Empty', project=self.project)

        self.assertTrue(folder.is_empty())
        self.assertEqual(folder.cascade_counts(), {'folders': 0, 'notes': 0})


class NoteFolderFieldTest(TestCase):
    """Tests for the folder field added to Note"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='notefolderuser',
            email='notefolder@test.com',
            password='TestPass123!'
        )
        self.project = Project.objects.create(
            title='Note Folder Project',
            user=self.user
        )
        self.folder = Folder.objects.create(
            name='Archives',
            project=self.project
        )

    def test_note_defaults_to_root(self):
        """Test that a note created without a folder sits at the root"""
        note = Note.objects.create(title='Loose note', project=self.project)
        self.assertIsNone(note.folder)

    def test_note_inside_folder(self):
        """Test attaching a note to a folder"""
        note = Note.objects.create(
            title='Filed note',
            project=self.project,
            folder=self.folder
        )

        self.assertEqual(note.folder, self.folder)
        self.assertIn(note, self.folder.notes.all())

    def test_existing_notes_remain_valid_without_folder(self):
        """Test backward compatibility: notes without a folder stay usable"""
        note = Note.objects.create(title='Legacy note', project=self.project)

        note.content = 'Updated content'
        note.save()
        note.refresh_from_db()

        self.assertIsNone(note.folder)
        self.assertEqual(note.content, 'Updated content')
        self.assertIn(note, self.project.notes.all())
