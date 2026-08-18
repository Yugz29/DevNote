import { useCallback, useEffect, useRef, useState } from "react";

export function useResourceList({ projectId, fetchPage, scrollRef, resetKey }) {
  const requestKey = `${projectId ?? ""}|${resetKey ?? ""}`;

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const [loadedKey, setLoadedKey] = useState(null);
  const [error, setError] = useState(null);

  const nextPageUrlRef = useRef(null);
  const isLoadingRef = useRef(false);
  const fetchPageRef = useRef(fetchPage);

  useEffect(() => {
    fetchPageRef.current = fetchPage;
  });

  const fetchFirstPage = useCallback(async () => {
    if (!projectId) return;

    nextPageUrlRef.current = null;
    isLoadingRef.current = true;

    try {
      const data = await fetchPageRef.current(projectId, null);
      nextPageUrlRef.current = data.next ?? null;
      setItems(data.results ?? data);
      setError(null);
    } catch (loadError) {
      console.error("Error loading content", loadError);
      setItems([]);
      setError("Unable to load content");
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
      setLoadedKey(requestKey);
    }
  }, [projectId, requestKey]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await fetchFirstPage();
  }, [fetchFirstPage]);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !nextPageUrlRef.current || !projectId) return;

    isLoadingRef.current = true;

    try {
      const data = await fetchPageRef.current(null, nextPageUrlRef.current);
      nextPageUrlRef.current = data.next ?? null;
      setItems((current) => [...current, ...(data.results ?? data)]);
    } catch (loadMoreError) {
      console.error("Error loading more content:", loadMoreError);
    } finally {
      isLoadingRef.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  useEffect(() => {
    const scrollContainer = scrollRef?.current;
    if (!scrollContainer) return;

    const onScroll = () => {
      const distanceFromBottom =
        scrollContainer.scrollHeight -
        scrollContainer.scrollTop -
        scrollContainer.clientHeight;

      if (distanceFromBottom < 100) loadMore();
    };

    scrollContainer.addEventListener("scroll", onScroll);
    return () => scrollContainer.removeEventListener("scroll", onScroll);
  }, [scrollRef, loadMore]);

  return {
    items,
    isLoading: isLoading || loadedKey !== requestKey,
    error,
    reload,
    loadMore,
    setItems,
  };
}
