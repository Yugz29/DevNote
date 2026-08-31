import { useCallback, useEffect, useState } from "react";
import CopyButton from "./CopyButton.jsx";
import DnSelect from "./DnSelect.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { timeAgo } from "../lib/relativeTime.js";
import {
  createApiToken,
  getApiTokens,
  revokeApiToken,
} from "../services/apiTokenService.js";

const LIFETIMES = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "never", label: "No expiry" },
];

const DEFAULT_LIFETIME = "365";

const LOAD_ERROR = "Could not load your tokens. Please try again.";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : null;

function TokenRow({ token, onRevoke }) {
  const expiry = formatDate(token.expires_at);

  return (
    <div className="api-token" data-token={token.id}>
      <div className="api-token-text">
        <h4>
          {token.name}
          {token.is_expired && <span className="api-token-tag">expired</span>}
        </h4>
        <p>
          <code>{token.prefix}…</code>
          <span>
            {token.last_used_at
              ? `used ${timeAgo(token.last_used_at)}`
              : "never used"}
          </span>
          <span>{expiry ? `expires ${expiry}` : "no expiry"}</span>
        </p>
      </div>

      <button
        type="button"
        className="api-token-revoke"
        title={`Revoke ${token.name}`}
        onClick={() => onRevoke(token)}
      >
        <i className="ph-light ph-trash" />
        <span>Revoke</span>
      </button>
    </div>
  );
}

export default function ApiTokenSettings() {
  const { showConfirm } = useDialog();

  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [lifetime, setLifetime] = useState(DEFAULT_LIFETIME);
  const [secret, setSecret] = useState(null);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await getApiTokens();

      setTokens(loaded);
      setGeneralError("");
    } catch {
      setGeneralError(LOAD_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isStale = false;

    const loadOnMount = async () => {
      try {
        const loaded = await getApiTokens();

        if (!isStale) setTokens(loaded);
      } catch {
        if (!isStale) setGeneralError(LOAD_ERROR);
      } finally {
        if (!isStale) setIsLoading(false);
      }
    };

    loadOnMount();

    return () => {
      isStale = true;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting || !name.trim()) return;

    setNameError("");
    setGeneralError("");
    setIsSubmitting(true);

    try {
      const created = await createApiToken(
        name.trim(),
        lifetime === "never" ? null : Number(lifetime),
      );

      setSecret(created);
      setName("");
      setLifetime(DEFAULT_LIFETIME);
      await load();
    } catch (error) {
      const data = error.response?.data;

      if (data?.name?.length) {
        setNameError(data.name[0]);
      } else {
        setGeneralError(
          data?.error ?? "Could not create the token. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (token) => {
    const confirmed = await showConfirm(
      `Revoke "${token.name}"? Anything still using it stops working right away.`,
      "Revoke",
    );

    if (!confirmed) return;

    try {
      await revokeApiToken(token.id);

      if (secret?.id === token.id) setSecret(null);

      await load();
    } catch {
      setGeneralError("Could not revoke the token. Please try again.");
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-row">
        <div className="settings-row-text">
          <h3>What these are for</h3>
          <p>
            A token lets a script, a CLI or an agent reach your workspace over
            the API, where a browser session cannot follow. It carries your own
            access and nothing more, and it cannot create or revoke other
            tokens.
          </p>
        </div>
      </div>

      <form className="settings-block" noValidate onSubmit={handleSubmit}>
        <div className="settings-row-text">
          <h3>New token</h3>
          <p>The secret is shown once, right after you create it.</p>
        </div>

        <div className="settings-fields">
          <div className="settings-field">
            <label htmlFor="settings-token-name">Name</label>
            <input
              type="text"
              id="settings-token-name"
              placeholder="Claude Code"
              maxLength={100}
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError("");
              }}
            />
            {nameError && <p className="settings-field-error">{nameError}</p>}
          </div>

          <div className="settings-field">
            <span className="settings-field-label">Expires</span>
            <DnSelect
              label="Token lifetime"
              options={LIFETIMES}
              value={lifetime}
              onChange={setLifetime}
            />
          </div>
        </div>

        {generalError && <p className="settings-field-error">{generalError}</p>}

        <div className="settings-block-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? "Creating..." : "Create token"}
          </button>
        </div>
      </form>

      {secret && (
        <div className="settings-block api-token-secret">
          <div className="settings-row-text">
            <h3>Copy “{secret.name}” now</h3>
            <p>
              DevNote keeps only a digest of it. Once you leave this screen it
              cannot be shown again.
            </p>
          </div>

          <div className="api-token-secret-value">
            <code>{secret.token}</code>
            <CopyButton text={secret.token} />
          </div>

          <div className="settings-block-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setSecret(null)}
            >
              I saved it
            </button>
          </div>
        </div>
      )}

      <div className="settings-block">
        <div className="settings-row-text">
          <h3>Your tokens</h3>
          <p>Revoking one cuts off everything still holding it.</p>
        </div>

        {isLoading && <p className="api-token-empty">Loading…</p>}

        {!isLoading && tokens.length === 0 && (
          <p className="api-token-empty">No token yet.</p>
        )}

        {tokens.length > 0 && (
          <div className="api-token-list">
            {tokens.map((token) => (
              <TokenRow key={token.id} token={token} onRevoke={handleRevoke} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
