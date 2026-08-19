import CardMenu from "./CardMenu.jsx";
import CodeBlock from "./CodeBlock.jsx";
import CopyButton from "./CopyButton.jsx";
import HighlightText from "./HighlightText.jsx";
import LanguageIcon from "./LanguageIcon.jsx";

const PREVIEW_LENGTH = 200;

export default function SnippetCard({
  snippet,
  searchQuery,
  onOpen,
  onDuplicate,
  onTogglePin,
  onExport,
  onMove,
  onDelete,
}) {
  const preview =
    snippet.content.length > PREVIEW_LENGTH
      ? `${snippet.content.substring(0, PREVIEW_LENGTH)}\n...`
      : snippet.content;

  return (
    <div className="snippet-card" data-id={snippet.id} onClick={onOpen}>
      <div
        className="snippet-card-header"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="snippet-lang-badge">
          <LanguageIcon language={snippet.language} />
          <span className="snippet-lang-name">
            {snippet.language || "text"}
          </span>
        </div>

        <div className="item-actions">
          <CardMenu
            label={`Actions for ${snippet.title}`}
            items={[
              {
                label: "Duplicate",
                icon: "ph-files",
                onSelect: onDuplicate,
              },
              {
                label: snippet.is_pinned ? "Unpin" : "Pin",
                icon: snippet.is_pinned ? "ph-push-pin-slash" : "ph-push-pin",
                onSelect: onTogglePin,
              },
              {
                label: "Export",
                icon: "ph-export",
                onSelect: onExport,
              },
              {
                label: "Move to…",
                icon: "ph-arrow-elbow-down-right",
                onSelect: onMove,
              },
              {
                label: "Delete",
                icon: "ph-trash",
                isDanger: true,
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      </div>

      <h4 className="snippet-title">
        <button type="button" className="snippet-title-btn" onClick={onOpen}>
          <HighlightText text={snippet.title} query={searchQuery} />
        </button>
      </h4>

      {snippet.description && (
        <p className="snippet-description">
          <HighlightText text={snippet.description} query={searchQuery} />
        </p>
      )}

      <div className="snippet-preview-wrap">
        <CodeBlock
          code={preview}
          language={snippet.language}
          className="snippet-preview"
        />

        <div
          className="snippet-preview-actions"
          onClick={(event) => event.stopPropagation()}
        >
          <CopyButton text={snippet.content} className="btn-card-icon-action" />
        </div>
      </div>

      <div className="snippet-card-footer">
        <span className="card-date">
          {snippet.is_pinned && (
            <i className="ph-light ph-push-pin gallery-card-pin" />
          )}
          {new Date(snippet.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
