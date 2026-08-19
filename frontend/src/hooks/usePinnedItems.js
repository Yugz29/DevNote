import { useCallback, useEffect, useState } from "react";

import { getPinnedDocuments } from "../services/documentService.js";
import { getPinnedSnippets } from "../services/snippetService.js";

const EMPTY = { items: [], count: 0 };

const toList = (data) => {
  const results = data.results ?? data;
  return { items: results, count: data.count ?? results.length };
};

export function usePinnedItems(projectId) {
  const [documents, setDocuments] = useState(EMPTY);
  const [snippets, setSnippets] = useState(EMPTY);
  const [loadedProjectId, setLoadedProjectId] = useState(null);

  const reload = useCallback(async () => {
    if (!projectId) return;

    const [documentsResult, snippetsResult] = await Promise.allSettled([
      getPinnedDocuments(projectId),
      getPinnedSnippets(projectId),
    ]);

    if (documentsResult.status === "fulfilled") {
      setDocuments(toList(documentsResult.value));
    } else {
      console.error("Error loading pinned documents:", documentsResult.reason);
      setDocuments(EMPTY);
    }

    if (snippetsResult.status === "fulfilled") {
      setSnippets(toList(snippetsResult.value));
    } else {
      console.error("Error loading pinned snippets:", snippetsResult.reason);
      setSnippets(EMPTY);
    }

    setLoadedProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    const load = async () => {
      await reload();
    };

    load();
  }, [reload]);

  return {
    documents,
    snippets,
    isLoading: Boolean(projectId) && loadedProjectId !== projectId,
    reload,
  };
}
