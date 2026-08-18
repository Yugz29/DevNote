from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase
from rest_framework import status
from workspace.models import Folder, Note, Project

User = get_user_model()


def unwrap(response):
    """Return the list payload whether or not pagination is active"""
    if isinstance(response.data, dict) and 'results' in response.data:
        return response.data['results']
    return response.data


class FolderViewTest(APITestCase):
    """Tests for Folder API views"""

    def setUp(self):
        """Helper to create a test user, project, folder and authenticate"""
        self.user = User.objects.create_user(
            username='folderviewuser',
            email='folderview@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title='Folder View Project',
            description='A project for folder view testing.',
            user=self.user
        )

        self.folder = Folder.objects.create(
            name='Archives',
            project=self.project
        )

    def test_list_folders_authenticated(self):
        """Test listing folders when authenticated"""
        response = self.client.get(f'/api/projects/{self.project.id}/folders/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        folders = unwrap(response)
        self.assertEqual(len(folders), 1)
        self.assertEqual(folders[0]['name'], 'Archives')
        self.assertIn('id', folders[0])
        self.assertIsNone(folders[0]['parent'])

    def test_list_folders_unauthenticated(self):
        """Test listing folders without authentication returns 401"""
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/projects/{self.project.id}/folders/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_excludes_other_users_folders(self):
        """Test that folders of another user are not listed"""
        other_user = User.objects.create_user(
            username='otherviewuser',
            email='otherview@test.com',
            password='TestPass123!'
        )
        other_project = Project.objects.create(
            title='Foreign Project', user=other_user
        )
        Folder.objects.create(name='Foreign', project=other_project)

        response = self.client.get('/api/folders/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folders = unwrap(response)
        self.assertEqual(len(folders), 1)
        self.assertEqual(folders[0]['name'], 'Archives')

    def test_create_folder(self):
        """Test creating a folder at the project root"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/folders/',
            {'name': 'Drafts'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Drafts')
        self.assertEqual(response.data['project_id'], str(self.project.id))
        self.assertIsNone(response.data['parent'])
        self.assertEqual(Folder.objects.count(), 2)

    def test_create_nested_folder(self):
        """Test creating a folder inside another folder"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/folders/',
            {'name': 'Nested', 'parent': str(self.folder.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['parent'], self.folder.id)

    def test_create_duplicate_name_rejected(self):
        """Test that a duplicate name at the same level returns 400"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/folders/',
            {'name': 'Archives'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_create_folder_in_foreign_project_denied(self):
        """Test that creating a folder in another user's project is denied"""
        other_user = User.objects.create_user(
            username='foreignowner',
            email='foreignowner@test.com',
            password='TestPass123!'
        )
        other_project = Project.objects.create(
            title='Foreign Project', user=other_user
        )

        response = self.client.post(
            f'/api/projects/{other_project.id}/folders/',
            {'name': 'Intruder'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Folder.objects.filter(name='Intruder').count(), 0)

    def test_rename_folder(self):
        """Test renaming a folder"""
        response = self.client.patch(
            f'/api/folders/{self.folder.id}/',
            {'name': 'Renamed'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.folder.refresh_from_db()
        self.assertEqual(self.folder.name, 'Renamed')

    def test_move_folder_to_another_parent(self):
        """Test moving a folder under another parent"""
        target = Folder.objects.create(name='Target', project=self.project)

        response = self.client.patch(
            f'/api/folders/{self.folder.id}/',
            {'parent': str(target.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.folder.refresh_from_db()
        self.assertEqual(self.folder.parent, target)

    def test_move_folder_back_to_root(self):
        """Test moving a folder back to the project root"""
        child = Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )

        response = self.client.patch(
            f'/api/folders/{child.id}/',
            {'parent': None},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        child.refresh_from_db()
        self.assertIsNone(child.parent)

    def test_move_into_self_rejected(self):
        """Test that moving a folder into itself returns 400"""
        response = self.client.patch(
            f'/api/folders/{self.folder.id}/',
            {'parent': str(self.folder.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('parent', response.data)

    def test_move_into_descendant_rejected(self):
        """Test that moving a folder into its own descendant returns 400"""
        child = Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )
        grandchild = Folder.objects.create(
            name='Grandchild', project=self.project, parent=child
        )

        response = self.client.patch(
            f'/api/folders/{self.folder.id}/',
            {'parent': str(grandchild.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('parent', response.data)

    def test_filter_by_parent(self):
        """Test narrowing the listing to the children of one folder"""
        child = Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )
        Folder.objects.create(name='Sibling', project=self.project)

        response = self.client.get(
            f'/api/projects/{self.project.id}/folders/?parent={self.folder.id}'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folders = unwrap(response)
        self.assertEqual(len(folders), 1)
        self.assertEqual(folders[0]['id'], str(child.id))

    def test_filter_by_parent_null(self):
        """Test listing only the folders at the project root"""
        Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )

        response = self.client.get(
            f'/api/projects/{self.project.id}/folders/?parent=null'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folders = unwrap(response)
        self.assertEqual(len(folders), 1)
        self.assertEqual(folders[0]['name'], 'Archives')

    def test_filter_by_invalid_parent(self):
        """Test that a malformed parent id returns 400 rather than 500"""
        response = self.client.get(
            f'/api/projects/{self.project.id}/folders/?parent=not-a-uuid'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_contents_endpoint(self):
        """Test listing the direct subfolders and notes of a folder"""
        child = Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )
        Folder.objects.create(
            name='Grandchild', project=self.project, parent=child
        )
        note = Note.objects.create(
            title='Filed note', project=self.project, folder=self.folder
        )
        Note.objects.create(
            title='Deep note', project=self.project, folder=child
        )
        Note.objects.create(title='Root note', project=self.project)

        response = self.client.get(f'/api/folders/{self.folder.id}/contents/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

        entries = response.data['results']
        self.assertEqual(entries[0]['type'], 'folder')
        self.assertEqual(entries[0]['id'], str(child.id))
        self.assertEqual(entries[1]['type'], 'note')
        self.assertEqual(entries[1]['id'], str(note.id))

    def test_contents_is_paginated(self):
        """Test that contents follows the pagination shape of the API"""
        for index in range(30):
            Folder.objects.create(
                name=f'Child {index:02d}',
                project=self.project,
                parent=self.folder
            )

        response = self.client.get(f'/api/folders/{self.folder.id}/contents/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data.keys()),
            {'count', 'next', 'previous', 'results'}
        )
        self.assertEqual(response.data['count'], 30)
        self.assertEqual(len(response.data['results']), 20)
        self.assertIsNotNone(response.data['next'])
        self.assertIsNone(response.data['previous'])

    def test_contents_second_page(self):
        """Test that the second page returns the remaining entries"""
        for index in range(30):
            Folder.objects.create(
                name=f'Child {index:02d}',
                project=self.project,
                parent=self.folder
            )

        response = self.client.get(
            f'/api/folders/{self.folder.id}/contents/?page=2'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 10)
        self.assertIsNone(response.data['next'])
        self.assertIsNotNone(response.data['previous'])
        self.assertEqual(response.data['results'][0]['name'], 'Child 20')

    def test_contents_page_spanning_folders_and_notes(self):
        """Test a page boundary falling across the two underlying lists"""
        for index in range(15):
            Folder.objects.create(
                name=f'Child {index:02d}',
                project=self.project,
                parent=self.folder
            )

        for index in range(15):
            Note.objects.create(
                title=f'Note {index:02d}',
                project=self.project,
                folder=self.folder
            )

        first = self.client.get(f'/api/folders/{self.folder.id}/contents/')
        second = self.client.get(
            f'/api/folders/{self.folder.id}/contents/?page=2'
        )

        self.assertEqual(first.data['count'], 30)
        self.assertEqual(len(first.data['results']), 20)
        self.assertEqual(len(second.data['results']), 10)

        types = [entry['type'] for entry in first.data['results']]
        self.assertEqual(types.count('folder'), 15)
        self.assertEqual(types.count('note'), 5)
        self.assertEqual(types[:15], ['folder'] * 15)

        self.assertTrue(
            all(entry['type'] == 'note' for entry in second.data['results'])
        )

        ids = [entry['id'] for entry in first.data['results']]
        ids += [entry['id'] for entry in second.data['results']]
        self.assertEqual(len(set(ids)), 30)

    def test_contents_only_fetches_the_requested_page(self):
        """Test that paging does not materialize the whole folder"""
        for index in range(60):
            Folder.objects.create(
                name=f'Child {index:02d}',
                project=self.project,
                parent=self.folder
            )
            Note.objects.create(
                title=f'Note {index:02d}',
                project=self.project,
                folder=self.folder
            )

        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(
                f'/api/folders/{self.folder.id}/contents/?page=2'
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 120)

        row_queries = [
            query['sql'] for query in captured.captured_queries
            if not query['sql'].upper().startswith('SELECT COUNT(*)')
            and ('devnote_folders' in query['sql'] or 'devnote_notes' in query['sql'])
        ]

        self.assertTrue(row_queries)
        for sql in row_queries:
            self.assertIn('LIMIT', sql.upper())

    def test_contents_of_empty_folder(self):
        """Test the paginated shape of an empty folder"""
        response = self.client.get(f'/api/folders/{self.folder.id}/contents/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])

    def test_contents_of_foreign_folder_denied(self):
        """Test that another user's folder cannot be inspected"""
        other_user = User.objects.create_user(
            username='foreigncontents',
            email='foreigncontents@test.com',
            password='TestPass123!'
        )
        other_project = Project.objects.create(
            title='Foreign Project', user=other_user
        )
        foreign = Folder.objects.create(name='Foreign', project=other_project)

        response = self.client.get(f'/api/folders/{foreign.id}/contents/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_empty_folder(self):
        """Test that an empty folder is deleted without confirmation"""
        response = self.client.delete(f'/api/folders/{self.folder.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Folder.objects.count(), 0)

    def test_delete_non_empty_folder_requires_confirmation(self):
        """Test that a non-empty folder is not deleted without confirmation"""
        child = Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )
        Note.objects.create(
            title='Filed note', project=self.project, folder=self.folder
        )
        Note.objects.create(
            title='Deep note', project=self.project, folder=child
        )

        response = self.client.delete(f'/api/folders/{self.folder.id}/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'folder_not_empty')
        self.assertEqual(response.data['folders'], 1)
        self.assertEqual(response.data['notes'], 2)
        self.assertEqual(Folder.objects.count(), 2)
        self.assertEqual(Note.objects.count(), 2)

    def test_delete_non_empty_folder_with_confirmation(self):
        """Test that confirming deletes the folder and its whole subtree"""
        child = Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )
        Note.objects.create(
            title='Filed note', project=self.project, folder=self.folder
        )
        Note.objects.create(
            title='Deep note', project=self.project, folder=child
        )
        kept = Note.objects.create(title='Root note', project=self.project)

        response = self.client.delete(
            f'/api/folders/{self.folder.id}/?confirm=true'
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Folder.objects.count(), 0)
        self.assertEqual(Note.objects.count(), 1)
        self.assertEqual(Note.objects.first().id, kept.id)

    def test_delete_folder_holding_only_notes_requires_confirmation(self):
        """Test that notes alone are enough to require confirmation"""
        Note.objects.create(
            title='Filed note', project=self.project, folder=self.folder
        )

        response = self.client.delete(f'/api/folders/{self.folder.id}/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['folders'], 0)
        self.assertEqual(response.data['notes'], 1)

    def test_delete_foreign_folder_denied(self):
        """Test that another user's folder cannot be deleted"""
        other_user = User.objects.create_user(
            username='foreigndelete',
            email='foreigndelete@test.com',
            password='TestPass123!'
        )
        other_project = Project.objects.create(
            title='Foreign Project', user=other_user
        )
        foreign = Folder.objects.create(name='Foreign', project=other_project)

        response = self.client.delete(f'/api/folders/{foreign.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Folder.objects.filter(id=foreign.id).count(), 1)


class ProjectContentsViewTest(APITestCase):
    """Tests for the root-level contents endpoint"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='rootcontentsuser',
            email='rootcontents@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title='Root Contents Project',
            user=self.user
        )
        self.folder = Folder.objects.create(
            name='Archives', project=self.project
        )
        self.root_note = Note.objects.create(
            title='Root note', project=self.project
        )

    def test_root_contents_lists_folders_then_notes(self):
        """Test that the project root uses the same stream shape"""
        response = self.client.get(f'/api/projects/{self.project.id}/contents/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data.keys()),
            {'count', 'next', 'previous', 'results'}
        )
        self.assertEqual(response.data['count'], 2)

        entries = response.data['results']
        self.assertEqual(entries[0]['type'], 'folder')
        self.assertEqual(entries[0]['id'], str(self.folder.id))
        self.assertEqual(entries[1]['type'], 'note')
        self.assertEqual(entries[1]['id'], str(self.root_note.id))

    def test_root_contents_note_cards_carry_the_pin_state(self):
        """Test that gallery cards report whether the note is pinned"""
        pinned = Note.objects.create(
            title='Pinned note', project=self.project, is_pinned=True
        )

        response = self.client.get(f'/api/projects/{self.project.id}/contents/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cards = {
            entry['id']: entry
            for entry in response.data['results']
            if entry['type'] == 'note'
        }

        self.assertTrue(cards[str(pinned.id)]['is_pinned'])
        self.assertFalse(cards[str(self.root_note.id)]['is_pinned'])

    def test_root_contents_excludes_nested_entries(self):
        """Test that entries inside folders are not listed at the root"""
        child = Folder.objects.create(
            name='Nested', project=self.project, parent=self.folder
        )
        Note.objects.create(
            title='Nested note', project=self.project, folder=child
        )

        response = self.client.get(f'/api/projects/{self.project.id}/contents/')

        self.assertEqual(response.data['count'], 2)
        ids = [entry['id'] for entry in response.data['results']]
        self.assertNotIn(str(child.id), ids)

    def test_root_contents_is_paginated(self):
        """Test that the root stream paginates like the folder one"""
        for index in range(30):
            Note.objects.create(
                title=f'Note {index:02d}', project=self.project
            )

        response = self.client.get(f'/api/projects/{self.project.id}/contents/')

        self.assertEqual(response.data['count'], 32)
        self.assertEqual(len(response.data['results']), 20)
        self.assertIsNotNone(response.data['next'])

    def test_root_contents_unauthenticated(self):
        """Test that the root stream requires authentication"""
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/projects/{self.project.id}/contents/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_root_contents_of_foreign_project_denied(self):
        """Test that another user's project cannot be inspected"""
        other_user = User.objects.create_user(
            username='foreignroot',
            email='foreignroot@test.com',
            password='TestPass123!'
        )
        other_project = Project.objects.create(
            title='Foreign Project', user=other_user
        )

        response = self.client.get(
            f'/api/projects/{other_project.id}/contents/'
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ContentsPayloadTest(APITestCase):
    """Tests for the lightweight note payload used by the gallery"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='contentspayloaduser',
            email='contentspayload@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title='Payload Project', user=self.user
        )
        self.note = Note.objects.create(
            title='Sprint plan',
            content='# Sprint plan\n\nSome **bold** text and `code`.',
            project=self.project
        )

    def entry(self, response):
        return next(
            item for item in response.data['results'] if item['type'] == 'note'
        )

    def test_note_entry_shape(self):
        """Test that a gallery note carries an excerpt, not its content"""
        response = self.client.get(f'/api/projects/{self.project.id}/contents/')
        entry = self.entry(response)

        self.assertEqual(
            set(entry.keys()),
            {
                'type', 'id', 'title', 'preview', 'project_id',
                'folder', 'is_pinned', 'created_at', 'updated_at',
            }
        )
        self.assertNotIn('content', entry)

    def test_preview_is_plain_text(self):
        """Test that the excerpt carries no Markdown syntax"""
        response = self.client.get(f'/api/projects/{self.project.id}/contents/')
        entry = self.entry(response)

        self.assertEqual(entry['preview'], 'Sprint plan Some bold text and code.')

    def test_preview_is_bounded(self):
        """Test that a long note yields a bounded excerpt"""
        self.note.content = 'lorem ipsum ' * 500
        self.note.save()

        response = self.client.get(f'/api/projects/{self.project.id}/contents/')
        entry = self.entry(response)

        self.assertLessEqual(len(entry['preview']), 221)
        self.assertTrue(entry['preview'].endswith('…'))

    def test_payload_stays_small_for_long_notes(self):
        """Test that the response no longer carries whole note bodies"""
        for index in range(10):
            Note.objects.create(
                title=f'Long note {index}',
                content='x' * 20000,
                project=self.project
            )

        response = self.client.get(f'/api/projects/{self.project.id}/contents/')

        self.assertLess(len(response.content), 20000)

    def test_folder_entry_still_carries_counts(self):
        """Test that the lighter notes did not affect folder entries"""
        folder = Folder.objects.create(name='Archives', project=self.project)
        Note.objects.create(
            title='Filed', project=self.project, folder=folder
        )

        response = self.client.get(f'/api/projects/{self.project.id}/contents/')
        entry = response.data['results'][0]

        self.assertEqual(entry['type'], 'folder')
        self.assertEqual(entry['note_count'], 1)

    def test_detail_endpoint_still_returns_content(self):
        """Test that opening a note still yields its full Markdown"""
        response = self.client.get(f'/api/notes/{self.note.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['content'], self.note.content)
        self.assertNotIn('preview', response.data)


class FolderCountsTest(APITestCase):
    """Tests for the direct counts exposed on folder payloads"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='foldercountsuser',
            email='foldercounts@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title='Counts Project', user=self.user
        )
        self.folder = Folder.objects.create(
            name='Archives', project=self.project
        )

    def test_counts_are_zero_when_empty(self):
        """Test the counts of an empty folder"""
        response = self.client.get(f'/api/projects/{self.project.id}/folders/')

        entry = unwrap(response)[0]
        self.assertEqual(entry['folder_count'], 0)
        self.assertEqual(entry['note_count'], 0)

    def test_counts_are_direct_children_only(self):
        """Test that the counts do not include nested entries"""
        child = Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )
        Folder.objects.create(
            name='Grandchild', project=self.project, parent=child
        )
        Note.objects.create(
            title='Direct', project=self.project, folder=self.folder
        )
        Note.objects.create(
            title='Second direct', project=self.project, folder=self.folder
        )
        Note.objects.create(
            title='Nested', project=self.project, folder=child
        )

        response = self.client.get(
            f'/api/projects/{self.project.id}/folders/?parent=null'
        )

        entry = unwrap(response)[0]
        self.assertEqual(entry['folder_count'], 1)
        self.assertEqual(entry['note_count'], 2)

    def test_counts_present_in_contents_stream(self):
        """Test that folders carry their counts inside the mixed stream"""
        Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )
        Note.objects.create(
            title='Direct', project=self.project, folder=self.folder
        )

        response = self.client.get(f'/api/projects/{self.project.id}/contents/')

        entry = response.data['results'][0]
        self.assertEqual(entry['type'], 'folder')
        self.assertEqual(entry['folder_count'], 1)
        self.assertEqual(entry['note_count'], 1)

    def test_counts_do_not_multiply_across_relations(self):
        """Test the classic double-join inflation on two aggregates"""
        for index in range(3):
            Folder.objects.create(
                name=f'Child {index}', project=self.project, parent=self.folder
            )
        for index in range(4):
            Note.objects.create(
                title=f'Note {index}', project=self.project, folder=self.folder
            )

        response = self.client.get(
            f'/api/projects/{self.project.id}/folders/?parent=null'
        )

        entry = unwrap(response)[0]
        self.assertEqual(entry['folder_count'], 3)
        self.assertEqual(entry['note_count'], 4)

    def test_counts_without_annotation(self):
        """Test the fallback used when the queryset is not annotated"""
        Folder.objects.create(
            name='Child', project=self.project, parent=self.folder
        )
        Note.objects.create(
            title='Direct', project=self.project, folder=self.folder
        )

        response = self.client.get(f'/api/folders/{self.folder.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['folder_count'], 1)
        self.assertEqual(response.data['note_count'], 1)


class NoteFolderViewTest(APITestCase):
    """Tests for the folder field on the Note endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='notefolderview',
            email='notefolderview@test.com',
            password='TestPass123!'
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title='Note Folder View Project',
            user=self.user
        )
        self.folder = Folder.objects.create(
            name='Archives',
            project=self.project
        )
        self.root_note = Note.objects.create(
            title='Root note',
            project=self.project
        )
        self.filed_note = Note.objects.create(
            title='Filed note',
            project=self.project,
            folder=self.folder
        )

    def test_project_notes_still_returns_every_note(self):
        """Test backward compatibility: the project listing stays flat"""
        response = self.client.get(f'/api/projects/{self.project.id}/notes/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notes = unwrap(response)
        self.assertEqual(len(notes), 2)

    def test_folder_field_exposed(self):
        """Test that the folder id is present in the note payload"""
        response = self.client.get(f'/api/notes/{self.filed_note.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['folder'], self.folder.id)

    def test_filter_notes_by_folder(self):
        """Test listing the notes of one folder"""
        response = self.client.get(
            f'/api/projects/{self.project.id}/notes/?folder={self.folder.id}'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notes = unwrap(response)
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]['id'], str(self.filed_note.id))

    def test_filter_notes_at_root(self):
        """Test listing the notes outside any folder"""
        response = self.client.get(
            f'/api/projects/{self.project.id}/notes/?folder=null'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notes = unwrap(response)
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]['id'], str(self.root_note.id))

    def test_filter_notes_by_invalid_folder(self):
        """Test that a malformed folder id returns 400 rather than 500"""
        response = self.client.get(
            f'/api/projects/{self.project.id}/notes/?folder=not-a-uuid'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_note_in_folder(self):
        """Test creating a note directly inside a folder"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/notes/',
            {'title': 'New filed note', 'folder': str(self.folder.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['folder'], self.folder.id)

    def test_create_note_without_folder(self):
        """Test backward compatibility of the existing create payload"""
        response = self.client.post(
            f'/api/projects/{self.project.id}/notes/',
            {'title': 'New loose note', 'content': 'Body'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['folder'])

    def test_move_note_into_folder(self):
        """Test moving an existing note into a folder"""
        response = self.client.patch(
            f'/api/notes/{self.root_note.id}/',
            {'folder': str(self.folder.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.root_note.refresh_from_db()
        self.assertEqual(self.root_note.folder, self.folder)

    def test_move_note_to_foreign_folder_rejected(self):
        """Test that a folder from another project is rejected"""
        other_project = Project.objects.create(
            title='Other Project', user=self.user
        )
        foreign = Folder.objects.create(name='Foreign', project=other_project)

        response = self.client.patch(
            f'/api/notes/{self.root_note.id}/',
            {'folder': str(foreign.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('folder', response.data)
