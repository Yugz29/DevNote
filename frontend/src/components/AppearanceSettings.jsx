import SettingsChoice from "./SettingsChoice.jsx";
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

        <SettingsChoice
          label="Colour theme"
          options={THEMES}
          value={theme}
          onChange={() => toggleTheme()}
        />
      </div>
    </div>
  );
}
