import { useTheme } from "../contexts/ThemeContext.js";

const THEMES = [
  { value: "dark", label: "Dark", icon: "ph-moon" },
  { value: "light", label: "Light", icon: "ph-sun" },
];

export default function AppearanceSettings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="settings-section">
      <div className="settings-row">
        <div className="settings-row-text">
          <h3>Theme</h3>
          <p>Applies to this browser only, and is remembered between visits.</p>
        </div>

        <div
          className="settings-choice"
          role="radiogroup"
          aria-label="Colour theme"
        >
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className={`settings-choice-option${theme === option.value ? " active" : ""}`}
              data-theme-option={option.value}
              onClick={() => {
                if (theme !== option.value) toggleTheme();
              }}
            >
              <i className={`ph-light ${option.icon}`} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
