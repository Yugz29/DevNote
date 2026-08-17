from django.test import TestCase
from workspace.preview import markdown_to_plain_text, note_preview


class MarkdownToPlainTextTest(TestCase):
    """Tests for the Markdown stripping used by gallery cards"""

    def test_empty_input(self):
        self.assertEqual(markdown_to_plain_text(''), '')
        self.assertEqual(markdown_to_plain_text(None), '')

    def test_headings(self):
        self.assertEqual(
            markdown_to_plain_text('# Title\n\n## Subtitle\n\nBody'),
            'Title Subtitle Body'
        )

    def test_emphasis(self):
        self.assertEqual(
            markdown_to_plain_text('Some **bold**, *italic* and ***both***.'),
            'Some bold, italic and both.'
        )

    def test_strikethrough(self):
        self.assertEqual(markdown_to_plain_text('~~gone~~ kept'), 'gone kept')

    def test_inline_code(self):
        self.assertEqual(
            markdown_to_plain_text('Run `npm run build` now.'),
            'Run npm run build now.'
        )

    def test_fenced_code_keeps_its_text(self):
        self.assertEqual(
            markdown_to_plain_text('Intro\n\n```python\nx = 1\n```\n\nEnd'),
            'Intro x = 1 End'
        )

    def test_links_keep_their_label(self):
        self.assertEqual(
            markdown_to_plain_text('See [the docs](https://example.com).'),
            'See the docs.'
        )

    def test_images_are_dropped(self):
        self.assertEqual(
            markdown_to_plain_text('Before ![alt](img.png) after'),
            'Before after'
        )

    def test_lists(self):
        self.assertEqual(
            markdown_to_plain_text('- one\n- two\n\n1. three\n2. four'),
            'one two three four'
        )

    def test_blockquote(self):
        self.assertEqual(
            markdown_to_plain_text('> quoted line\n\nplain'),
            'quoted line plain'
        )

    def test_horizontal_rule(self):
        self.assertEqual(markdown_to_plain_text('a\n\n---\n\nb'), 'a b')

    def test_table(self):
        self.assertEqual(
            markdown_to_plain_text(
                '| Key | Value |\n|---|---|\n| one | two |'
            ),
            'Key Value one two'
        )

    def test_html_tags(self):
        self.assertEqual(
            markdown_to_plain_text('<div>text</div>'), 'text'
        )

    def test_hard_line_breaks_from_the_editor(self):
        """Test the backslash breaks BlockNote writes when saving a note"""
        self.assertEqual(
            markdown_to_plain_text('> **Projet :** DevNote\\\n>  **Période :** 2026'),
            'Projet : DevNote Période : 2026'
        )

    def test_escapes(self):
        self.assertEqual(markdown_to_plain_text(r'a \* b'), 'a * b')

    def test_front_matter_is_dropped(self):
        self.assertEqual(
            markdown_to_plain_text('---\ntitle: x\n---\nBody'), 'Body'
        )


class NotePreviewTest(TestCase):
    """Tests for the truncation applied on top of the stripping"""

    def test_short_text_is_untouched(self):
        self.assertEqual(note_preview('# Hello\n\nWorld'), 'Hello World')

    def test_long_text_is_truncated(self):
        preview = note_preview('word ' * 200, max_length=50)

        self.assertLessEqual(len(preview), 51)
        self.assertTrue(preview.endswith('…'))

    def test_truncation_falls_on_a_word_boundary(self):
        preview = note_preview('alpha beta gamma delta epsilon', max_length=14)

        self.assertEqual(preview, 'alpha beta…')

    def test_truncation_without_usable_space(self):
        preview = note_preview('a' * 100, max_length=20)

        self.assertEqual(preview, f"{'a' * 20}…")

    def test_empty_content(self):
        self.assertEqual(note_preview(''), '')
