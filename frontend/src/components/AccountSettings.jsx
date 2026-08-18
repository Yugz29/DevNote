import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.js";
import { changePassword } from "../services/authService.js";

const EMPTY_FORM = {
  currentPassword: "",
  newPassword: "",
  newPassword2: "",
};

const FIELDS = [
  {
    name: "currentPassword",
    apiName: "current_password",
    label: "Current password",
    autoComplete: "current-password",
  },
  {
    name: "newPassword",
    apiName: "new_password",
    label: "New password",
    autoComplete: "new-password",
  },
  {
    name: "newPassword2",
    apiName: "new_password2",
    label: "Confirm new password",
    autoComplete: "new-password",
  },
];

export default function AccountSettings() {
  const { user, signOut } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isComplete = Object.values(form).every((value) => value.length > 0);

  const handleChange = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: [] }));
    setGeneralError("");
    setIsSaved(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting || !isComplete) return;

    setErrors({});
    setGeneralError("");
    setIsSaved(false);
    setIsSubmitting(true);

    try {
      await changePassword(
        form.currentPassword,
        form.newPassword,
        form.newPassword2,
      );
      setForm(EMPTY_FORM);
      setIsSaved(true);
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        setErrors(
          Object.fromEntries(
            FIELDS.map((field) => [
              field.name,
              [data[field.apiName] ?? []].flat(),
            ]),
          ),
        );
        setGeneralError(data.non_field_errors?.[0] ?? data.error ?? "");
      }

      if (!data || typeof data !== "object") {
        setGeneralError("Could not update your password. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasFieldErrors = FIELDS.some((field) => errors[field.name]?.length);

  return (
    <div className="settings-section">
      <div className="settings-row">
        <div className="settings-row-text">
          <h3>Email</h3>
          <p>The address you sign in with.</p>
        </div>
        <span className="settings-value">{user?.email ?? "..."}</span>
      </div>

      <form className="settings-block" noValidate onSubmit={handleSubmit}>
        <div className="settings-row-text">
          <h3>Password</h3>
          <p>Changing it signs your other browsers out of DevNote.</p>
        </div>

        <div className="settings-fields">
          {FIELDS.map((field) => (
            <div key={field.name} className="settings-field">
              <label htmlFor={`settings-${field.name}`}>{field.label}</label>
              <input
                type="password"
                id={`settings-${field.name}`}
                autoComplete={field.autoComplete}
                placeholder="••••••••"
                aria-invalid={errors[field.name]?.length ? true : undefined}
                value={form[field.name]}
                onChange={handleChange(field.name)}
              />
              {errors[field.name]?.map((message) => (
                <p key={message} className="settings-field-error">
                  {message}
                </p>
              ))}
            </div>
          ))}
        </div>

        {generalError && <p className="settings-field-error">{generalError}</p>}

        {isSaved && !hasFieldErrors && (
          <p className="settings-field-success">
            <i className="ph-light ph-check-circle" />
            Password updated.
          </p>
        )}

        <div className="settings-block-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || !isComplete}
          >
            {isSubmitting ? "Updating..." : "Update password"}
          </button>
        </div>
      </form>

      <div className="settings-row">
        <div className="settings-row-text">
          <h3>Sign out</h3>
          <p>Ends this session and takes you back to the login page.</p>
        </div>
        <button
          type="button"
          className="settings-signout"
          onClick={() => signOut()}
        >
          <i className="ph-light ph-sign-out" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
