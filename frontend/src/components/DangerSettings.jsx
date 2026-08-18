import { useState } from "react";
import DeleteAccountDialog from "./DeleteAccountDialog.jsx";
import { useAuth } from "../contexts/AuthContext.js";

export default function DangerSettings() {
  const { user, deleteAccount } = useAuth();
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <div className="settings-section">
      <div className="settings-row is-danger">
        <div className="settings-row-text">
          <h3>Delete account</h3>
          <p>
            Removes your account and every project, note, snippet and todo it
            holds. There is no way back.
          </p>
        </div>

        <button
          type="button"
          className="settings-danger-btn"
          onClick={() => setIsConfirming(true)}
        >
          <i className="ph-light ph-trash" />
          <span>Delete account</span>
        </button>
      </div>

      {isConfirming && (
        <DeleteAccountDialog
          email={user?.email ?? ""}
          onCancel={() => setIsConfirming(false)}
          onConfirm={deleteAccount}
        />
      )}
    </div>
  );
}
