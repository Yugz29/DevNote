import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext.js";

const COLORS = {
  dark: {
    background: "#161b22",
    border: "1px solid #30363d",
    color: "#8b949e",
    boxShadow: "none",
  },
  light: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.12)",
    color: "#475569",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
};

const BASE_STYLE = {
  position: "fixed",
  bottom: "24px",
  right: "24px",
  zIndex: 9999,
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "16px",
  outline: "none",
  transition: "transform 0.15s",
};

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      id="theme-toggle"
      aria-label="Toggle theme"
      onClick={toggleTheme}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...BASE_STYLE,
        ...COLORS[theme],
        transform: isHovered ? "scale(1.1)" : "scale(1)",
      }}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
