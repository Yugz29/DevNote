import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeContext } from "./ThemeContext.js";

const STORAGE_KEY = "devnote-theme";

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "dark",
  );
  const timeoutRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const toggleTheme = useCallback(() => {
    document.documentElement.classList.add("theme-switching");
    setTheme((current) => (current === "dark" ? "light" : "dark"));

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      document.documentElement.classList.remove("theme-switching");
    }, 750);
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
