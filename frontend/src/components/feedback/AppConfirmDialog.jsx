import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function AppConfirmDialog({
  open,
  eyebrow = 'Xác nhận thao tác',
  title,
  description = '',
  details = [],
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Quay lại',
  reasonLabel = '',
  reasonPlaceholder = '',
  reasonRequired = false,
  loading = false,
  onClose,
  onConfirm
}) {
  const [reason, setReason] = useState('');
  const reasonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setReason('');
    const timer = window.setTimeout(() => reasonRef.current?.focus(), 50);

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !loading) onClose?.();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  const normalizedReason = reason.trim();
  const disabled = loading || (reasonRequired && !normalizedReason);

  function submit(event) {
    event.preventDefault();
    if (disabled) {
      reasonRef.current?.focus();
      return;
    }
    onConfirm?.(normalizedReason);
  }

  return createPortal(
    <div className="app-confirm-backdrop" role="presentation">
      <section
        className="app-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
      >
        <div className="app-confirm-icon" aria-hidden="true">!</div>

        <header className="app-confirm-heading">
          <span>{eyebrow}</span>
          <h3 id="app-confirm-title">{title}</h3>
          {description ? <p>{description}</p> : null}
        </header>

        {details.length ? (
          <div className="app-confirm-details">
            {details.map((item) => (
              <div key={`${item.label}-${item.value}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        <form onSubmit={submit}>
          {reasonLabel ? (
            <label className="app-confirm-reason">
              <span>{reasonLabel}{reasonRequired ? ' *' : ''}</span>
              <textarea
                ref={reasonRef}
                rows="3"
                maxLength="300"
                value={reason}
                placeholder={reasonPlaceholder}
                onChange={(event) => setReason(event.target.value)}
                disabled={loading}
                required={reasonRequired}
              />
              <small>{normalizedReason.length}/300 ký tự</small>
            </label>
          ) : null}

          <footer className="app-confirm-actions">
            <button
              type="button"
              className="operation-secondary-action"
              onClick={onClose}
              disabled={loading}
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className="app-confirm-primary"
              disabled={disabled}
            >
              {loading ? 'Đang xử lý...' : confirmLabel}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
