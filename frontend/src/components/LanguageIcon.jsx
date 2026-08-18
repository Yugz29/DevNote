import { DEVICONS } from "../lib/languages.js";

export default function LanguageIcon({ language }) {
  const iconClass = DEVICONS[language?.toLowerCase()];

  if (iconClass) {
    return <i className={`${iconClass} snippet-lang-icon`} />;
  }

  return <span className="snippet-lang-text">{language || "text"}</span>;
}
