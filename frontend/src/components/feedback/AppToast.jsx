import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { localizeApiMessage } from '../../utils/apiErrorMessage';

function inferTone(message) {
  const value = String(message || '').toLowerCase();
  if (/không thể|không tải|thất bại|lỗi|không hợp lệ|đã hết|đã được đặt|không còn|vui lòng|bắt buộc/.test(value)) {
    return 'error';
  }
  if (/thành công|đã tạo|đã lưu|đã cập nhật|đã hủy|đã ghi nhận|đã check-in|đã nhập|đã bán|giữ chỗ/.test(value)) {
    return 'success';
  }
  return 'info';
}

function normalizeNotice(message, explicitTone) {
  if (!message) return null;

  if (typeof message === 'object' && message.text) {
    return {
      id: message.id || message.text,
      text: localizeApiMessage(String(message.text)) || String(message.text),
      title: message.title || '',
      tone: explicitTone || message.tone || inferTone(message.text)
    };
  }

  return {
    id: String(message),
    text: localizeApiMessage(String(message)) || String(message),
    title: '',
    tone: explicitTone || inferTone(message)
  };
}

export default function AppToast({ message, tone, duration = 5200, onDismiss }) {
  const notice = useMemo(() => normalizeNotice(message, tone), [message, tone]);
  const [visible, setVisible] = useState(Boolean(notice));

  useEffect(() => {
    if (!notice) {
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
  }, [notice?.id, duration, onDismiss]);

  if (!notice || !visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className="app-toast-region" aria-live={notice.tone === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
      <div className={`app-toast app-toast--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
        <span className="app-toast-indicator" aria-hidden="true" />
        <div className="app-toast-copy">
          {notice.title ? <strong className="app-toast-title">{notice.title}</strong> : null}
          <span className="app-toast-message">{notice.text}</span>
        </div>
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
