import AppearanceSettings from "./AppearanceSettings.jsx";
import { findSettingsSection } from "../lib/settingsSections.js";

const SECTION_COMPONENTS = {
  appearance: AppearanceSettings,
};

function SectionPlaceholder({ label }) {
  return (
    <div className="settings-placeholder">
      <i className="ph-light ph-wrench" />
      <p>{label} is not available yet.</p>
      <span>This section is coming in a later step.</span>
    </div>
  );
}

export default function SettingsPanel({ section }) {
  const current = findSettingsSection(section);
  const Section = SECTION_COMPONENTS[current.key];

  return (
    <div id="settings-view" className="settings-view">
      <header className="settings-header">
        <h1>{current.label}</h1>
        <p className="settings-header-hint">{current.hint}</p>
      </header>

      <div className="settings-content">
        {Section ? <Section /> : <SectionPlaceholder label={current.label} />}
      </div>
    </div>
  );
}
