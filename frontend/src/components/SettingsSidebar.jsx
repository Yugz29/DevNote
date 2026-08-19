import { SETTINGS_SECTIONS } from "../lib/settingsSections.js";

export default function SettingsSidebar({
  activeSection,
  onSelectSection,
  onBack,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <button
            id="settings-back"
            className="btn-icon-sm"
            title="Back to projects"
            onClick={onBack}
          >
            <i className="ph-light ph-arrow-left" />
          </button>
          <h2>Settings</h2>
        </div>
      </div>

      <nav className="settings-nav" aria-label="Settings sections">
        {SETTINGS_SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            className={`settings-nav-item${section.key === activeSection ? " active" : ""}${section.isDanger ? " is-danger" : ""}`}
            data-section={section.key}
            aria-current={section.key === activeSection ? "page" : undefined}
            onClick={() => onSelectSection(section.key)}
          >
            <i className={`ph-light ${section.icon}`} />
            <span>{section.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="settings-back-link" onClick={onBack}>
          <i className="ph-light ph-arrow-left" />
          <span>Back to projects</span>
        </button>
      </div>
    </aside>
  );
}
