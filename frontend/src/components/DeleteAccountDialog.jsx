import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal.jsx";

const CONFIRMATION = "DELETE";

export default function DeleteAccountDialog({ email, onCancel, onConfirm }) {
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [errors, setErrors] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isPhraseTyped = phrase === CONFIRMATION;
  const canDelete = password.length > 0 && isPhraseTyped && !isDeleting;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canDelete) return;

    setErrors([]);
    setIsDeleting(true);

    try {
      await onConfirm(password);
    } catch (error) {
      const data = error.response?.data;

      setErrors(
        [data?.current_password ?? data?.detail ?? data?.error]
          .flat()
          .filter(Boolean),
      );
      setPassword("");
      setIsDeleting(false);
      inputRef.current?.focus();
    }
  };

  return createPortal(
    <Modal isOpen title="Delete your account" onClose={onCancel}>
      <form className="delete-account" noValidate onSubmit={handleSubmit}>
        <div className="delete-account-warning">
          <i className="ph-light ph-warning-octagon" />
          <div>
            <p>
              This permanently deletes <strong>{email}</strong> and everything
              in it.
            </p>
            <p className="delete-account-scope">
              Projects, notes, snippets, todos, folders and lists all go with
              it. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="settings-field">
          <label htmlFor="delete-account-password">
            Enter your password to confirm
          </label>
          <input
            ref={inputRef}
            type="password"
            id="delete-account-password"
            autoComplete="off"
            placeholder="••••••••"
            aria-invalid={errors.length ? true : undefined}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors([]);
            }}
          />
          {errors.map((message) => (
            <p key={message} className="settings-field-error">
              {message}
            </p>
          ))}
        </div>

        <div className="settings-field">
          <label htmlFor="delete-account-phrase">
            Then type <code>{CONFIRMATION}</code> to be sure
          </label>
          <input
            type="text"
            id="delete-account-phrase"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            placeholder={CONFIRMATION}
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="dn-dialog-btn dn-dialog-btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="dn-dialog-btn dn-dialog-btn--danger"
            disabled={!canDelete}
          >
            {isDeleting ? "Deleting..." : "Delete my account"}
          </button>
        </div>
      </form>
    </Modal>,
    document.body,
  );
}
