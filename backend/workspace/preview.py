"""Plain-text excerpts derived from the Markdown stored on a note."""

import re

RULES = [
    (re.compile(r"\A---\n.*?\n---\n", re.S), ""),
    (re.compile(r"```[^\n]*\n?"), " "),
    (re.compile(r"~~~[^\n]*\n?"), " "),
    (re.compile(r"!\[[^\]]*\]\([^)]*\)"), " "),
    (re.compile(r"\[([^\]]*)\]\([^)]*\)"), r"\1"),
    (re.compile(r"</?[a-zA-Z][^>]*>"), " "),
    (re.compile(r"^[ ]{0,3}#{1,6}[ ]+", re.M), ""),
    (re.compile(r"^[ ]{0,3}>[ ]?", re.M), ""),
    (re.compile(r"^[ ]{0,3}([-*+]|\d+[.)])[ ]+", re.M), ""),
    (re.compile(r"^[ \t]*\|?[\s:|-]{3,}\|?[ \t]*$", re.M), " "),
    (re.compile(r"\|"), " "),
    (re.compile(r"^[ \t]*([-*_])[ \t]*(?:\1[ \t]*){2,}$", re.M), " "),
    (re.compile(r"\\\n"), " "),
    (re.compile(r"(\*\*\*|___)(.*?)\1"), r"\2"),
    (re.compile(r"(\*\*|__)(.*?)\1"), r"\2"),
    (re.compile(r"(\*|_)(.*?)\1"), r"\2"),
    (re.compile(r"~~(.*?)~~"), r"\1"),
    (re.compile(r"`+([^`]*)`+"), r"\1"),
    (re.compile(r"\\([\\`*_{}\[\]()#+\-.!])"), r"\1"),
]

WHITESPACE = re.compile(r"\s+")

MAX_LENGTH = 220


def markdown_to_plain_text(markdown):
    if not markdown:
        return ""

    text = markdown

    for pattern, replacement in RULES:
        text = pattern.sub(replacement, text)

    return WHITESPACE.sub(" ", text).strip()


def note_preview(markdown, max_length=MAX_LENGTH):
    """Truncate on a word boundary, so cards never cut mid-word."""
    text = markdown_to_plain_text(markdown)

    if len(text) <= max_length:
        return text

    clipped = text[:max_length]
    last_space = clipped.rfind(" ")

    if last_space > max_length * 0.6:
        clipped = clipped[:last_space]

    return f"{clipped.rstrip()}…"
