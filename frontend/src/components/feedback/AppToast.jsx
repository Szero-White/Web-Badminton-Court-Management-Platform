import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

function inferTone(message) {
  const value = String(message || '').toLowerCase();
  if (/không thể|không tải|thất bại|lỗi|không hợp lệ|đã hết|đã được đặt|không còn/.test(value)) {
    return 'error';
  }
  if (/thành công|đã tạo|đã lưu|đã cập nhật|đã hủy|đã ghi nhận|đã check-in|đã nhập|đã bán|giữ chỗ/.test(value)) {
    return 'success';
  }
  return 'info';
}

export default function AppToast({ message, tone, duration = 4200, onDismiss }) {
  const [visible, setVisible] = useState(Boolean(message));
  const resolvedTone = useMemo(() => tone || inferTone(message), [message, tone]);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);
    if (!duration) return undefined;

    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message || !visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className="app-toast-region" aria-live="polite" aria-atomic="true">
      <div className={`app-toast app-toast--${resolvedTone}`} role={resolvedTone === 'error' ? 'alert' : 'status'}>
        <span className="app-toast-indicator" aria-hidden="true" />
        <span className="app-toast-message">{message}</span>
        <button
          type="button"
          className="app-toast-close"
          aria-label="Đóng thông báo"
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
        >
          ×
        </button>
      </div>
    </div>,
    document.body
  );
}
