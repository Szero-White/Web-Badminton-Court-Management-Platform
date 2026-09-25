import { useEffect, useMemo, useRef, useState } from 'react';

export default function AppSelect({
  value,
  onChange,
  options,
  placeholder = 'Chọn',
  disabled = false,
  className = '',
  ariaLabel
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);

  const normalizedOptions = useMemo(
    () => (options || []).map((option) => ({
      ...option,
      value: String(option.value)
    })),
    [options]
  );

  const selectedIndex = normalizedOptions.findIndex((option) => option.value === String(value ?? ''));
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null;

  useEffect(() => {
    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  function choose(option) {
    if (option.disabled) {
      return;
    }
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (disabled) {
      return;
    }

    if (!open && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (!open) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      let next = activeIndex;
      for (let count = 0; count < normalizedOptions.length; count += 1) {
        next = (next + direction + normalizedOptions.length) % normalizedOptions.length;
        if (!normalizedOptions[next]?.disabled) {
          setActiveIndex(next);
          break;
        }
      }
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = normalizedOptions[activeIndex];
      if (option) {
        choose(option);
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`app-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="app-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span className={selectedOption ? 'app-select-value' : 'app-select-placeholder'}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="app-select-chevron" aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="app-select-menu" role="listbox" tabIndex={-1}>
          {normalizedOptions.map((option, index) => (
            <button
              type="button"
              key={`${option.value}-${index}`}
              className={`app-select-option ${option.value === String(value ?? '') ? 'is-selected' : ''} ${index === activeIndex ? 'is-active' : ''}`.trim()}
              role="option"
              aria-selected={option.value === String(value ?? '')}
              disabled={option.disabled}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              <span className="app-select-option-main">{option.label}</span>
              {option.description ? <small>{option.description}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
