import { useCallback, useEffect, useRef, useState } from "react";

import { countResults } from "../lib/search.js";
import { search } from "../services/searchService.js";

const DEBOUNCE_MS = 300;

export function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("hint");
  const [results, setResults] = useState(null);
  const [searchedQuery, setSearchedQuery] = useState("");

  const debounceRef = useRef(null);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const reset = useCallback(() => {
    clearTimeout(debounceRef.current);
    setQuery("");
    setStatus("hint");
    setResults(null);
    setSearchedQuery("");
  }, []);

  const changeQuery = useCallback((value) => {
    setQuery(value);
    clearTimeout(debounceRef.current);

    const trimmed = value.trim();

    if (!trimmed) {
      setStatus("hint");
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setStatus("searching");

      try {
        const data = await search(trimmed);
        setResults(data);
        setSearchedQuery(trimmed);
        setStatus("done");
      } catch (searchError) {
        console.error("Search error:", searchError);
        setStatus("error");
      }
    }, DEBOUNCE_MS);
  }, []);

  return {
    query,
    status,
    results,
    searchedQuery,
    total: countResults(results),
    changeQuery,
    reset,
  };
}
