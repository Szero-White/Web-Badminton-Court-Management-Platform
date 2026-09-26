export function formatDayInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export const todayString = () => formatDayInput(new Date());

export function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDayInput(date);
}

export function startOfWeekMonday(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const weekday = date.getDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateString, offsetToMonday);
}

export function formatWeekdayDateLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const weekdayLabels = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return `${weekdayLabels[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`;
}

export function formatDateLabel(dateString) {
  return formatWeekdayDateLabel(dateString);
}

export function formatDateFull(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function timeKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function slotMinuteOfDay(value) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}
