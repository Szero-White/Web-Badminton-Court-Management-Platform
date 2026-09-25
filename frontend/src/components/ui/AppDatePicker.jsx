import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './AppDatePicker.css';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function parseDateValue(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  const date = parseDateValue(value);
  if (!date) return 'Chọn ngày';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric'
  });
}

function sameDate(left, right) {
  return Boolean(left && right) && toDateValue(left) === toDateValue(right);
}

function buildCalendarDays(visibleMonth) {
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const firstVisibleDay = new Date(firstDay);
  firstVisibleDay.setDate(firstVisibleDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDay);
    date.setDate(firstVisibleDay.getDate() + index);
    return date;
  });
}

export default function AppDatePicker({
  value,
  onChange,
  ariaLabel = 'Chọn ngày',
  className = ''
}) {
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => selectedDate || new Date()
  );
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth]
  );

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(selectedDate);
    }
  }, [selectedDate]);

  const updatePopupPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const popupWidth = Math.min(328, window.innerWidth - 24);
    const estimatedHeight = 390;
    const viewportPadding = 12;

    let left = rect.left;
    if (left + popupWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - popupWidth - viewportPadding;
    }
    left = Math.max(viewportPadding, left);

    let top = rect.bottom + 8;
    if (
      top + estimatedHeight > window.innerHeight - viewportPadding &&
      rect.top - estimatedHeight - 8 >= viewportPadding
    ) {
      top = rect.top - estimatedHeight - 8;
    }

    setPopupPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    updatePopupPosition();

    function handlePointerDown(event) {
      const inTrigger = triggerRef.current?.contains(event.target);
      const inPopup = popupRef.current?.contains(event.target);
      if (!inTrigger && !inPopup) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePopupPosition]);

  function changeMonth(offset) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1)
    );
  }

  function chooseDate(date) {
    onChange(toDateValue(date));
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function chooseToday() {
    chooseDate(new Date());
  }

  const popup = isOpen ? (
    <div
      ref={popupRef}
      className="app-calendar-popover"
      style={{ top: popupPosition.top, left: popupPosition.left }}
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel}
    >
      <div className="app-calendar-header">
        <button
          type="button"
          className="app-calendar-nav-button"
          onClick={() => changeMonth(-1)}
          aria-label="Tháng trước"
        >
          ‹
        </button>
        <strong>{formatMonthLabel(visibleMonth)}</strong>
        <button
          type="button"
          className="app-calendar-nav-button"
          onClick={() => changeMonth(1)}
          aria-label="Tháng sau"
        >
          ›
        </button>
      </div>

      <div className="app-calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="app-calendar-grid">
        {calendarDays.map((date) => {
          const dateValue = toDateValue(date);
          const isOutsideMonth = date.getMonth() !== visibleMonth.getMonth();
          const isSelected = sameDate(date, selectedDate);
          const isToday = sameDate(date, new Date());

          return (
            <button
              key={dateValue}
              type="button"
              className={[
                'app-calendar-day',
                isOutsideMonth ? 'is-outside' : '',
                isSelected ? 'is-selected' : '',
                isToday ? 'is-today' : ''
              ].filter(Boolean).join(' ')}
              onClick={() => chooseDate(date)}
              aria-label={date.toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
              aria-pressed={isSelected}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="app-calendar-footer">
        <button type="button" className="app-calendar-today" onClick={chooseToday}>
          Hôm nay
        </button>
        <button
          type="button"
          className="app-calendar-close"
          onClick={() => setIsOpen(false)}
        >
          Đóng
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className={`app-date-picker ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className={`app-date-picker-display ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${ariaLabel}: ${formatDisplayDate(value)}`}
      >
        <span>{formatDisplayDate(value)}</span>
        <span className="app-date-picker-icon" aria-hidden="true">▦</span>
      </button>

      {typeof document !== 'undefined' && popup
        ? createPortal(popup, document.body)
        : null}
    </div>
  );
}
