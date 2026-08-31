"""Tests for the DevNote API client, run without a live DevNote."""

import io
import json
import os
import socket
import sys
import unittest
import urllib.error
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from devnote_client import (  # noqa: E402
    DevNoteAuthError,
    DevNoteClient,
    DevNoteError,
    DevNoteHTTPError,
    DevNoteTimeout,
    DevNoteUnavailable,
    best_effort,
)

BASE_URL = "http://devnote.test"

TOKEN = "dnt_secret"


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exception):
        self.close()
        return False


def answer(payload):
    return FakeResponse(json.dumps(payload).encode("utf-8"))


def http_error(status, payload=None):
    return urllib.error.HTTPError(
        f"{BASE_URL}/api/projects/",
        status,
        "error",
        {},
        io.BytesIO(json.dumps(payload or {"detail": "nope"}).encode("utf-8")),
    )


class TransportTest(unittest.TestCase):
    """The HTTP layer: headers, decoding and error mapping"""

    def setUp(self):
        self.client = DevNoteClient(BASE_URL, TOKEN, timeout=2.0)

    def test_a_token_is_required(self):
        with self.assertRaises(DevNoteError):
            DevNoteClient(BASE_URL, "")

    def test_request_carries_the_token_and_decodes_the_body(self):
        with mock.patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value = answer({"email": "owner@example.com"})

            result = self.client.whoami()

            request = urlopen.call_args.args[0]

        self.assertEqual(result["email"], "owner@example.com")
        self.assertEqual(request.get_header("Authorization"), f"Bearer {TOKEN}")
        self.assertEqual(request.full_url, f"{BASE_URL}/api/auth/me/")
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 2.0)

    def test_a_write_sends_json(self):
        with mock.patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value = answer({"id": "1"})

            self.client.create_project("Automated")

            request = urlopen.call_args.args[0]

        self.assertEqual(request.method, "POST")
        self.assertEqual(request.get_header("Content-type"), "application/json")
        self.assertEqual(json.loads(request.data)["title"], "Automated")

    def test_none_params_are_dropped_from_the_query(self):
        url = self.client.build_url("projects/", {"folder": None, "archived": "true"})

        self.assertEqual(url, f"{BASE_URL}/api/projects/?archived=true")

    def test_an_empty_body_decodes_to_none(self):
        with mock.patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value = FakeResponse(b"")

            self.assertIsNone(self.client.delete_document("abc"))

    def test_a_refused_token_raises_an_auth_error(self):
        for status in (401, 403):
            with self.subTest(status=status):
                with mock.patch(
                    "urllib.request.urlopen", side_effect=http_error(status)
                ):
                    with self.assertRaises(DevNoteAuthError):
                        self.client.whoami()

    def test_another_error_status_carries_its_payload(self):
        with mock.patch(
            "urllib.request.urlopen",
            side_effect=http_error(400, {"title": ["This field is required."]}),
        ):
            with self.assertRaises(DevNoteHTTPError) as caught:
                self.client.create_project("")

        self.assertEqual(caught.exception.status, 400)
        self.assertIn("title", caught.exception.payload)

    def test_a_timeout_raises_a_timeout(self):
        with mock.patch("urllib.request.urlopen", side_effect=socket.timeout()):
            with self.assertRaises(DevNoteTimeout):
                self.client.whoami()

    def test_a_timeout_wrapped_in_a_url_error_raises_a_timeout(self):
        error = urllib.error.URLError(socket.timeout())

        with mock.patch("urllib.request.urlopen", side_effect=error):
            with self.assertRaises(DevNoteTimeout):
                self.client.whoami()

    def test_a_closed_port_raises_unavailable(self):
        error = urllib.error.URLError(ConnectionRefusedError("refused"))

        with mock.patch("urllib.request.urlopen", side_effect=error):
            with self.assertRaises(DevNoteUnavailable):
                self.client.whoami()

    def test_an_unreadable_body_stays_a_devnote_error(self):
        with mock.patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value = FakeResponse(b"<html>not json</html>")

            with self.assertRaises(DevNoteError):
                self.client.whoami()

    def test_every_failure_is_a_devnote_error(self):
        for error in (
            http_error(401),
            http_error(500),
            socket.timeout(),
            urllib.error.URLError(ConnectionRefusedError()),
            OSError("broken"),
        ):
            with self.subTest(error=type(error).__name__):
                with mock.patch("urllib.request.urlopen", side_effect=error):
                    with self.assertRaises(DevNoteError):
                        self.client.whoami()


class PaginationTest(unittest.TestCase):
    """Listings walk every page DRF hands out"""

    def setUp(self):
        self.client = DevNoteClient(BASE_URL, TOKEN)

    def test_collect_follows_the_next_link(self):
        pages = [
            answer(
                {
                    "count": 3,
                    "next": f"{BASE_URL}/api/projects/?page=2",
                    "results": [{"title": "One"}, {"title": "Two"}],
                }
            ),
            answer({"count": 3, "next": None, "results": [{"title": "Three"}]}),
        ]

        with mock.patch("urllib.request.urlopen", side_effect=pages) as urlopen:
            projects = self.client.list_projects()

            second = urlopen.call_args_list[1].args[0]

        self.assertEqual(
            [project["title"] for project in projects], ["One", "Two", "Three"]
        )
        self.assertIn("page=2", second.full_url)

    def test_collect_accepts_an_unpaginated_answer(self):
        with mock.patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value = answer([{"title": "One"}])

            self.assertEqual(len(self.client.list_projects()), 1)


class WorkspaceTest(unittest.TestCase):
    """The idempotent helpers an import relies on"""

    def setUp(self):
        self.client = DevNoteClient(BASE_URL, TOKEN)
        self.calls = []

    def record(self, results):
        """Stub the transport with canned answers, keeping the calls made."""

        def fake_request(method, path, params=None, payload=None):
            self.calls.append((method, path, params, payload))
            return results.pop(0)

        self.client.request = fake_request

    def test_find_project_matches_on_the_exact_title(self):
        self.record([{"next": None, "results": [{"id": "1", "title": "Pulse"}]}])

        self.assertEqual(self.client.find_project("Pulse")["id"], "1")

    def test_find_project_returns_none_when_nothing_matches(self):
        self.record([{"next": None, "results": [{"id": "1", "title": "Pulse"}]}])

        self.assertIsNone(self.client.find_project("Takt"))

    def test_ensure_folder_reuses_an_existing_one(self):
        self.record([{"next": None, "results": [{"id": "f1", "name": "Specs"}]}])

        folder = self.client.ensure_folder("p1", "Specs")

        self.assertEqual(folder["id"], "f1")
        self.assertEqual(len(self.calls), 1)

    def test_ensure_folder_creates_a_missing_one_at_the_right_level(self):
        self.record([{"next": None, "results": []}, {"id": "f2", "name": "Specs"}])

        self.client.ensure_folder("p1", "Specs", parent="f1")

        listing, creation = self.calls

        self.assertEqual(listing[2], {"resource_type": "documents", "parent": "f1"})
        self.assertEqual(creation[0], "POST")
        self.assertEqual(creation[3]["parent"], "f1")

    def test_ensure_folder_path_nests_each_level(self):
        self.record(
            [
                {"next": None, "results": []},
                {"id": "f1", "name": "Specs"},
                {"next": None, "results": []},
                {"id": "f2", "name": "API"},
            ]
        )

        folder = self.client.ensure_folder_path("p1", ["Specs", "API"])

        self.assertEqual(folder["id"], "f2")
        self.assertIsNone(self.calls[1][3]["parent"])
        self.assertEqual(self.calls[3][3]["parent"], "f1")

    def test_ensure_folder_path_returns_none_for_the_project_root(self):
        self.assertIsNone(self.client.ensure_folder_path("p1", []))

    def test_upsert_document_creates_a_new_one(self):
        self.record([{"next": None, "results": []}, {"id": "d1", "title": "Vision"}])

        self.client.upsert_document("p1", "Vision", "# Vision")

        listing, creation = self.calls

        self.assertEqual(listing[2], {"folder": "null"})
        self.assertEqual(creation[0], "POST")
        self.assertEqual(creation[3]["title"], "Vision")

    def test_upsert_document_rewrites_a_matching_title(self):
        self.record(
            [
                {"next": None, "results": [{"id": "d1", "title": "Vision"}]},
                {"id": "d1", "title": "Vision"},
            ]
        )

        self.client.upsert_document("p1", "Vision", "# Rewritten")

        update = self.calls[1]

        self.assertEqual(update[0], "PATCH")
        self.assertEqual(update[1], "documents/d1/")
        self.assertEqual(update[3], {"content": "# Rewritten"})

    def test_upsert_document_scopes_the_lookup_to_its_folder(self):
        self.record([{"next": None, "results": []}, {"id": "d1"}])

        self.client.upsert_document("p1", "Vision", "# Vision", folder="f1")

        self.assertEqual(self.calls[0][2], {"folder": "f1"})

    def test_list_documents_without_a_folder_asks_for_all_of_them(self):
        self.record([{"next": None, "results": []}])

        self.client.list_documents("p1")

        self.assertIsNone(self.calls[0][2])


class EnvironmentTest(unittest.TestCase):
    """from_env reads its configuration, and never writes any"""

    def test_from_env_builds_a_client(self):
        with mock.patch.dict(
            os.environ,
            {"DEVNOTE_URL": BASE_URL, "DEVNOTE_API_TOKEN": TOKEN},
            clear=True,
        ):
            client = DevNoteClient.from_env()

        self.assertEqual(client.base_url, BASE_URL)
        self.assertEqual(client.token, TOKEN)

    def test_from_env_needs_a_token(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(DevNoteError):
                DevNoteClient.from_env()

    def test_from_env_falls_back_on_localhost(self):
        with mock.patch.dict(os.environ, {"DEVNOTE_API_TOKEN": TOKEN}, clear=True):
            self.assertEqual(DevNoteClient.from_env().base_url, "http://localhost:8000")


class BestEffortTest(unittest.TestCase):
    """A DevNote failure must never reach the caller"""

    def test_a_successful_call_returns_its_value(self):
        self.assertEqual(best_effort(lambda: "value"), "value")

    def test_a_devnote_failure_returns_the_default(self):
        def failing():
            raise DevNoteTimeout("too slow")

        self.assertEqual(best_effort(failing, default=[]), [])

    def test_the_failure_can_be_reported(self):
        seen = []

        def failing():
            raise DevNoteUnavailable("down")

        best_effort(failing, on_error=seen.append)

        self.assertIsInstance(seen[0], DevNoteUnavailable)

    def test_a_programming_error_still_surfaces(self):
        def broken():
            raise ValueError("a real bug")

        with self.assertRaises(ValueError):
            best_effort(broken)


if __name__ == "__main__":
    unittest.main()
