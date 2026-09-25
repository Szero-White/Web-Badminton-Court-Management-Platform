import { useEffect, useMemo, useRef, useState } from 'react';

export default function MultiSelectDropdown({
  label = 'Lọc dữ liệu',
  allLabel = 'Tất cả',
  triggerLabel = 'Tất cả',
  options = [],
  selectedValues = [],
  onChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  const normalizedSelected = useMemo(() => selectedValues.map(String), [selectedValues]);
  const allSelected = options.length > 0 && normalizedSelected.length === options.length;

  useEffect(() => {
    function handleOutsideClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  function updateValue(value) {
    const normalizedValue = String(value);
    const next = new Set(normalizedSelected);

    if (next.has(normalizedValue)) {
      next.delete(normalizedValue);
    } else {
      next.add(normalizedValue);
    }

    onChange(Array.from(next));
  }

  function clearSelection() {
    onChange([]);
  }

  function selectAll() {
    onChange(options.map((option) => String(option.value)));
  }

  return (
    <div className={`multi-select ${isOpen ? 'is-open' : ''}`} ref={rootRef}>
      <span className="toolbar-label">{label}</span>

      <button
        type="button"
        className="multi-select-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="multi-select-trigger-text">{triggerLabel}</span>
        <span className="multi-select-trigger-arrow">▾</span>
      </button>

      {isOpen ? (
        <div className="multi-select-menu" role="dialog" aria-label={label}>
          <div className="multi-select-actions">
            <button type="button" onClick={clearSelection}>Tất cả</button>
            <button type="button" onClick={selectAll} disabled={allSelected}>Chọn hết</button>
          </div>

          <label className="multi-select-option multi-select-option-all">
            <input
              type="checkbox"
              checked={normalizedSelected.length === 0}
              onChange={clearSelection}
            />
            <span className="option-copy">
              <strong>{allLabel}</strong>
              <small>Hiển thị toàn bộ dữ liệu trong bảng</small>
            </span>
          </label>

          <div className="multi-select-list">
            {options.map((option) => {
              const checked = normalizedSelected.includes(String(option.value));
              return (
                <label key={option.value} className="multi-select-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => updateValue(option.value)}
                  />
                  <span className="option-copy">
                    <strong>{option.label}</strong>
                    {option.description ? <small>{option.description}</small> : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
