export default function SettingsChoice({ label, options, value, onChange }) {
  return (
    <div className="settings-choice" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`settings-choice-option${value === option.value ? " active" : ""}`}
          data-choice={option.value}
          onClick={() => {
            if (value !== option.value) onChange(option.value);
          }}
        >
          <i className={`ph-light ${option.icon}`} />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
