export default function SearchField({
  className,
  inputRef,
  placeholder,
  value,
  status,
  onChange,
  onKeyDown,
  onSubmit,
}) {
  return (
    <form
      className={`tabs-search${className ? ` ${className}` : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(event);
      }}
    >
      <i className="ph-light ph-magnifying-glass tabs-search-icon" />
      <input
        ref={inputRef}
        type="text"
        className="tabs-search-input"
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      {status && <span className="tabs-search-status">{status}</span>}
    </form>
  );
}
