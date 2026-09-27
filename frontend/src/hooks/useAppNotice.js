import { useCallback, useState } from 'react';

let noticeSequence = 0;

function buildNotice(value, tone) {
  if (!value) return null;

  if (typeof value === 'object' && value.text) {
    noticeSequence += 1;
    return {
      id: `${Date.now()}-${noticeSequence}`,
      tone: value.tone || tone,
      title: value.title || '',
      text: String(value.text)
    };
  }

  noticeSequence += 1;
  return {
    id: `${Date.now()}-${noticeSequence}`,
    tone,
    title: '',
    text: String(value)
  };
}

export default function useAppNotice(initialValue = null) {
  const [notice, setNoticeState] = useState(() => buildNotice(initialValue));

  const setNotice = useCallback((value, tone) => {
    setNoticeState((current) => {
      const resolved = typeof value === 'function' ? value(current?.text || '') : value;
      return buildNotice(resolved, tone);
    });
  }, []);

  const clearNotice = useCallback(() => setNoticeState(null), []);
  const success = useCallback((text, title = '') => setNotice({ text, tone: 'success', title }), [setNotice]);
  const error = useCallback((text, title = '') => setNotice({ text, tone: 'error', title }), [setNotice]);
  const info = useCallback((text, title = '') => setNotice({ text, tone: 'info', title }), [setNotice]);
  const warning = useCallback((text, title = '') => setNotice({ text, tone: 'warning', title }), [setNotice]);

  return {
    notice,
    setNotice,
    clearNotice,
    success,
    error,
    info,
    warning
  };
}
