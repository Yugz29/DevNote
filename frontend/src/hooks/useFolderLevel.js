import { useCallback, useEffect, useState } from "react";
import { getFolders } from "../services/folderService.js";

const NOT_LOADED = Symbol("not-loaded");

async function fetchLevel(projectId, parentId) {
  const collected = [];
  let page = await getFolders(projectId, parentId);

  while (page) {
    collected.push(...(page.results ?? page));
    page = page.next ? await getFolders(null, null, page.next) : null;
  }

  return collected;
}

export function useFolderLevel(projectId, parentId) {
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState({
    key: NOT_LOADED,
    folders: [],
    error: null,
  });

  useEffect(() => {
    if (!projectId) return undefined;

    let cancelled = false;

    fetchLevel(projectId, parentId)
      .then((folders) => {
        if (!cancelled) setLoaded({ key: parentId, folders, error: null });
      })
      .catch((loadError) => {
        console.error("Error loading folders", loadError);
        if (!cancelled) {
          setLoaded({
            key: parentId,
            folders: [],
            error: "Unable to load folders",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, parentId, reloadToken]);

  const setFolders = useCallback((update) => {
    setLoaded((current) => ({
      ...current,
      folders: typeof update === "function" ? update(current.folders) : update,
    }));
  }, []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    folders: loaded.folders,
    isLoading: Boolean(projectId) && loaded.key !== parentId,
    error: loaded.error,
    reload,
    setFolders,
  };
}
