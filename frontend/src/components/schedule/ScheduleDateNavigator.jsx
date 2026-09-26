import AppDatePicker from '../ui/AppDatePicker';
import {
  addDays,
  formatDateFull,
  formatWeekdayDateLabel,
  startOfWeekMonday
} from '../../utils/dateTime';
import './ScheduleDateNavigator.css';

const DAYS_IN_WEEK = 7;
const WEEKDAY_COMPACT_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

function formatShortDate(dateString) {
  const parts = String(dateString || '').split('-');
  if (parts.length !== 3) return '';
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day) return '';
  return `${day}/${month}`;
}

function buildWeekDays(selectedDay) {
  const weekStart = startOfWeekMonday(selectedDay);
  return Array.from({ length: DAYS_IN_WEEK }, (_, offset) => {
    const day = addDays(weekStart, offset);
    return {
      day,
      label: `${WEEKDAY_COMPACT_LABELS[offset]}, ${formatShortDate(day)}`,
      detail: formatWeekdayDateLabel(day)
    };
  });
}

export default function ScheduleDateNavigator({
  value,
  onChange,
  title = '',
  description = '',
  eyebrow = '',
  className = '',
  children = null
}) {
  const weekDays = buildWeekDays(value);

  return (
    <div className={`schedule-date-nav ${className}`.trim()}>
      {(title || description || eyebrow) ? (
        <div className="schedule-date-nav-heading">
          {eyebrow ? <span className="schedule-date-nav-eyebrow">{eyebrow}</span> : null}
          {title ? <h3>{title}</h3> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}

      <div className="schedule-date-nav-controls" aria-label="Điều hướng lịch theo tuần">
        <div className="schedule-date-nav-week" aria-label="Chọn ngày trong tuần">
          {weekDays.map(({ day, label, detail }) => (
            <button
              key={day}
              type="button"
              className={value === day ? 'is-active' : ''}
              aria-label={detail}
              aria-pressed={value === day}
              title={detail}
              onClick={() => onChange(day)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="schedule-date-nav-picker">
          <AppDatePicker
            value={value}
            onChange={onChange}
            ariaLabel="Chọn ngày bất kỳ"
            className="schedule-date-nav-input"
          />
        </div>
      </div>

      {children ? <div className="schedule-date-nav-overview">{children}</div> : null}

      <div className="schedule-date-nav-banner">
        <div className="schedule-date-nav-current">
          <span className="schedule-date-nav-icon" aria-hidden="true">📅</span>
          <strong>{formatDateFull(value)}</strong>
        </div>

        <div className="schedule-date-nav-stepper">
          <button type="button" onClick={() => onChange(addDays(value, -DAYS_IN_WEEK))}>
            ← Tuần trước
          </button>
          <button type="button" onClick={() => onChange(addDays(value, DAYS_IN_WEEK))}>
            Tuần sau →
          </button>
        </div>
      </div>
    </div>
  );
}
