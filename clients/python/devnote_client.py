"""
Minimal DevNote API client for automated consumers.

Talks to the DRF endpoints with a personal API token, so every write goes
through the same serializers and permissions a browser would hit. Nothing is
imported from the Django project: this module is standard library only, so it
can be vendored into any tool that wants to read or write DevNote.

Every failure surfaces as a DevNoteError, and requests carry a short timeout,
so a caller can treat DevNote as optional enrichment and move on when it is
slow or down. best_effort() wraps that pattern.

    from devnote_client import DevNoteClient, best_effort

    client = DevNoteClient("http://localhost:8000", token)
    project = best_effort(lambda: client.find_project("Pulse 1-M3M36"))
"""

import argparse
import json
import os
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_BASE_URL = "http://localhost:8000"

DEFAULT_TIMEOUT = 5.0

URL_ENV_VAR = "DEVNOTE_URL"

TOKEN_ENV_VAR = "DEVNOTE_API_TOKEN"

USER_AGENT = "devnote-client/1.0"

UNSET = object()


class DevNoteError(Exception):
    """Anything that stopped a DevNote call from succeeding."""


class DevNoteTimeout(DevNoteError):
    """DevNote did not answer within the timeout."""


class DevNoteUnavailable(DevNoteError):
    """DevNote could not be reached at all."""


class DevNoteAuthError(DevNoteError):
    """The token was refused, or does not reach that resource."""


class DevNoteHTTPError(DevNoteError):
    """DevNote answered with an error status."""

    def __init__(self, status, payload, url):
        super().__init__(f"{status} on {url}: {payload}")
        self.status = status
        self.payload = payload
        self.url = url


def best_effort(call, default=None, on_error=None):
    """
    Run a DevNote call and swallow its failures.

    DevNote enriches a workflow, it never carries it, so a caller that cannot
    reach it should keep going with whatever it already had. on_error, when
    given, receives the exception for logging.
    """
    try:
        return call()
    except DevNoteError as error:
        if on_error is not None:
            on_error(error)
        return default


class DevNoteClient:
    """A DevNote workspace seen through its REST API."""

    def __init__(self, base_url, token, timeout=DEFAULT_TIMEOUT):
        if not token:
            raise DevNoteError("An API token is required.")

        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    @classmethod
    def from_env(cls, timeout=DEFAULT_TIMEOUT):
        """
        Build a client from DEVNOTE_URL and DEVNOTE_API_TOKEN.

        The environment is read at call time and nothing is written back, so
        nothing about this client outlives the process holding it.
        """
        token = os.environ.get(TOKEN_ENV_VAR)

        if not token:
            raise DevNoteError(f"{TOKEN_ENV_VAR} is not set.")

        return cls(
            os.environ.get(URL_ENV_VAR, DEFAULT_BASE_URL), token, timeout=timeout
        )

    # ----- transport -----

    def request(self, method, path, params=None, payload=None):
        """
        One HTTP call. Returns the decoded body, or None for an empty answer.
        """
        url = self.build_url(path, params)
        body = None if payload is None else json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(url, data=body, method=method)
        request.add_header("Authorization", f"Bearer {self.token}")
        request.add_header("Accept", "application/json")
        request.add_header("User-Agent", USER_AGENT)

        if body is not None:
            request.add_header("Content-Type", "application/json")

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return self.decode(response.read())

        except urllib.error.HTTPError as error:
            payload = self.decode(error.read(), quiet=True)

            if error.code in (401, 403):
                raise DevNoteAuthError(
                    f"DevNote refused the credentials ({error.code}): {payload}"
                ) from error

            raise DevNoteHTTPError(error.code, payload, url) from error

        except socket.timeout as error:
            raise DevNoteTimeout(f"DevNote timed out after {self.timeout}s") from error

        except urllib.error.URLError as error:
            if isinstance(error.reason, socket.timeout):
                raise DevNoteTimeout(
                    f"DevNote timed out after {self.timeout}s"
                ) from error

            raise DevNoteUnavailable(
                f"DevNote is unreachable: {error.reason}"
            ) from error

        except OSError as error:
            raise DevNoteUnavailable(f"DevNote is unreachable: {error}") from error

    def build_url(self, path, params=None):
        url = f"{self.base_url}/api/{path.lstrip('/')}"
        query = (
            {}
            if params is None
            else {key: value for key, value in params.items() if value is not None}
        )

        return f"{url}?{urllib.parse.urlencode(query)}" if query else url

    @staticmethod
    def decode(raw, quiet=False):
        if not raw:
            return None

        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            if quiet:
                return raw[:500]

            raise DevNoteError(f"DevNote answered with something unreadable: {error}")

    def collect(self, path, params=None):
        """Every page of a paginated listing, as one list."""
        page = self.request("GET", path, params=params)
        items = []

        while page is not None:
            if isinstance(page, list):
                return items + page

            items.extend(page.get("results", []))
            following = page.get("next")

            if not following:
                return items

            page = self.request_absolute(following)

        return items

    def request_absolute(self, url):
        """Follow a pagination link, which DRF returns as an absolute URL."""
        parsed = urllib.parse.urlsplit(url)
        path = parsed.path.split("/api/", 1)[-1]

        return self.request(
            "GET", path, params=dict(urllib.parse.parse_qsl(parsed.query))
        )

    # ----- account -----

    def whoami(self):
        """The account the token belongs to, and a cheap reachability probe."""
        return self.request("GET", "auth/me/")

    # ----- projects -----

    def list_projects(self, archived=False):
        return self.collect(
            "projects/", params={"archived": "true"} if archived else None
        )

    def find_project(self, title, archived=False):
        """The project carrying that exact title, or None."""
        for project in self.list_projects(archived=archived):
            if project.get("title") == title:
                return project

        return None

    def get_project(self, project_id):
        return self.request("GET", f"projects/{project_id}/")

    def create_project(self, title, description=""):
        return self.request(
            "POST", "projects/", payload={"title": title, "description": description}
        )

    def ensure_project(self, title, description=""):
        """The project with that title, created if it is not there yet."""
        return self.find_project(title) or self.create_project(title, description)

    # ----- folders -----

    def list_folders(self, project_id, parent=UNSET, resource_type="documents"):
        params = {"resource_type": resource_type}

        if parent is not UNSET:
            params["parent"] = "null" if parent is None else str(parent)

        return self.collect(f"projects/{project_id}/folders/", params=params)

    def create_folder(self, project_id, name, parent=None, resource_type="documents"):
        return self.request(
            "POST",
            f"projects/{project_id}/folders/",
            payload={
                "name": name,
                "parent": None if parent is None else str(parent),
                "resource_type": resource_type,
            },
        )

    def ensure_folder(self, project_id, name, parent=None, resource_type="documents"):
        """The folder with that name at that level, created if missing."""
        for folder in self.list_folders(project_id, parent, resource_type):
            if folder.get("name") == name:
                return folder

        return self.create_folder(project_id, name, parent, resource_type)

    def ensure_folder_path(self, project_id, names, resource_type="documents"):
        """
        Walk a chain of folder names from the project root, creating what is
        missing. Returns the deepest folder, or None for an empty chain.
        """
        folder = None

        for name in names:
            folder = self.ensure_folder(
                project_id,
                name,
                parent=None if folder is None else folder["id"],
                resource_type=resource_type,
            )

        return folder

    # ----- documents -----

    def list_documents(self, project_id, folder=UNSET):
        params = None

        if folder is not UNSET:
            params = {"folder": "null" if folder is None else str(folder)}

        return self.collect(f"projects/{project_id}/documents/", params=params)

    def get_document(self, document_id):
        return self.request("GET", f"documents/{document_id}/")

    def create_document(self, project_id, title, content="", folder=None):
        return self.request(
            "POST",
            f"projects/{project_id}/documents/",
            payload={
                "title": title,
                "content": content,
                "folder": None if folder is None else str(folder),
            },
        )

    def update_document(self, document_id, **fields):
        return self.request("PATCH", f"documents/{document_id}/", payload=fields)

    def delete_document(self, document_id):
        return self.request("DELETE", f"documents/{document_id}/")

    def upsert_document(self, project_id, title, content, folder=None):
        """
        Create the document, or rewrite the one already carrying that title in
        that folder, so an import can be replayed without piling up copies.
        """
        for document in self.list_documents(project_id, folder=folder):
            if document.get("title") == title:
                return self.update_document(document["id"], content=content)

        return self.create_document(project_id, title, content, folder)


# ----- command line -----


def resolve_project(client, reference):
    """A project named either by title or by id."""
    project = client.find_project(reference)

    if project is not None:
        return project

    try:
        return client.get_project(reference)
    except DevNoteError:
        raise DevNoteError(f"No project matching '{reference}'.")


def build_parser():
    parser = argparse.ArgumentParser(
        description="Read and write a DevNote workspace with a personal API token."
    )
    parser.add_argument(
        "--url",
        default=os.environ.get(URL_ENV_VAR, DEFAULT_BASE_URL),
        help=f"DevNote base URL (default {URL_ENV_VAR} or {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--timeout", type=float, default=DEFAULT_TIMEOUT, help="Request timeout"
    )

    commands = parser.add_subparsers(dest="command", required=True)

    commands.add_parser("whoami", help="Show the account behind the token")
    commands.add_parser("projects", help="List the projects")

    folders = commands.add_parser("folders", help="List the document folders")
    folders.add_argument("project")

    documents = commands.add_parser("documents", help="List the documents")
    documents.add_argument("project")

    put = commands.add_parser("put-doc", help="Create or rewrite one document")
    put.add_argument("project")
    put.add_argument("title")
    put.add_argument("--file", help="Markdown file to upload, stdin by default")
    put.add_argument(
        "--folder", help="Folder path inside the project, e.g. 'Specs/API'"
    )

    return parser


def run(arguments):
    client = DevNoteClient(
        arguments.url, os.environ.get(TOKEN_ENV_VAR), timeout=arguments.timeout
    )

    if arguments.command == "whoami":
        user = client.whoami()
        return f"{user['email']} ({user['first_name']} {user['last_name']})"

    if arguments.command == "projects":
        return (
            "\n".join(
                f"{project['id']}  {project['title']}"
                for project in client.list_projects()
            )
            or "No project."
        )

    project = resolve_project(client, arguments.project)

    if arguments.command == "folders":
        return (
            "\n".join(
                f"{folder['id']}  {folder['name']}"
                for folder in client.list_folders(project["id"])
            )
            or "No folder."
        )

    if arguments.command == "documents":
        return (
            "\n".join(
                f"{document['id']}  {document['title']}"
                for document in client.list_documents(project["id"])
            )
            or "No document."
        )

    content = (
        open(arguments.file, encoding="utf-8").read()
        if arguments.file
        else sys.stdin.read()
    )
    folder = client.ensure_folder_path(
        project["id"], [part for part in (arguments.folder or "").split("/") if part]
    )
    document = client.upsert_document(
        project["id"],
        arguments.title,
        content,
        folder=None if folder is None else folder["id"],
    )

    return f"{document['id']}  {document['title']}"


def main():
    arguments = build_parser().parse_args()

    try:
        print(run(arguments))
    except DevNoteError as error:
        print(f"devnote: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
