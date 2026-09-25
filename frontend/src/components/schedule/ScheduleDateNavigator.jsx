import AppDatePicker from '../ui/AppDatePicker';
import { addDays, formatDateFull, formatDateLabel, todayString } from '../../utils/dateTime';
import './ScheduleDateNavigator.css';

export default function ScheduleDateNavigator({
  value,
  onChange,
  title = '',
  description = '',
  eyebrow = '',
  shortcutDays = 7,
  className = '',
  children = null
}) {
  const shortcuts = Array.from({ length: shortcutDays }, (_, offset) => {
    const day = addDays(todayString(), offset);
    return { day, label: formatDateLabel(day) };
  });

  return (
    <div className={`schedule-date-nav ${className}`.trim()}>
      <div className="schedule-date-nav-head">
        {(title || description || eyebrow) ? (
          <div className="schedule-date-nav-heading">
            {eyebrow ? <span className="schedule-date-nav-eyebrow">{eyebrow}</span> : null}
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
        ) : null}

        <div className="schedule-date-nav-toolbar">
          <span className="schedule-date-nav-label">Xem ngày</span>

          <div className="schedule-date-nav-controls">
            <div className="schedule-date-nav-shortcuts" aria-label="Chọn nhanh ngày">
              {shortcuts.map(({ day, label }) => (
                <button
                  key={day}
                  type="button"
                  className={value === day ? 'is-active' : ''}
                  onClick={() => onChange(day)}
                >
                  {label}
                </button>
              ))}
            </div>

            <AppDatePicker
              value={value}
              onChange={onChange}
              ariaLabel="Chọn ngày"
              className="schedule-date-nav-input"
            />
          </div>
        </div>
      </div>

      <div className="schedule-date-nav-banner">
        <div className="schedule-date-nav-current">
          <span className="schedule-date-nav-icon" aria-hidden="true">📅</span>
          <strong>{formatDateFull(value)}</strong>
        </div>

        <div className="schedule-date-nav-stepper">
          <button type="button" onClick={() => onChange(addDays(value, -1))}>
            ← Hôm qua
          </button>
          <button type="button" onClick={() => onChange(addDays(value, 1))}>
            Ngày mai →
          </button>
        </div>
      </div>

      {children ? <div className="schedule-date-nav-footer">{children}</div> : null}
    </div>
  );
}
