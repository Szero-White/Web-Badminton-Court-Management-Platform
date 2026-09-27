const BOOKING_STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã đặt',
  checked_in: 'Đang sử dụng',
  completed: 'Hoàn thành',
  canceled: 'Đã hủy',
  no_show: 'Không đến',
  booked: 'Đã đặt'
};

export function bookingStatusLabel(status) {
  return BOOKING_STATUS_LABELS[String(status || '').toLowerCase()] || 'Đã đặt';
}

export function bookingTypeLabel(customerType) {
  if (customerType === 'monthly') return 'Khách cố định theo tháng';
  if (customerType === 'walk_in') return 'Khách vãng lai';
  return 'Đã có lịch';
}

export function bookingTypeTone(customerType) {
  if (customerType === 'monthly') return 'monthly';
  if (customerType === 'walk_in') return 'walkin';
  return 'booked';
}


export function formatBookingMoney(value) {
  return `${Math.max(0, Math.round(Number(value || 0))).toLocaleString('vi-VN')} VND`;
}

export function buildBookingHoverDetails(group, fallback = {}) {
  const source = group || fallback || {};
  const total = Math.max(0, Number(source.total_price || 0));
  const paid = Math.max(0, Number(source.deposit_paid || 0));
  const remaining = Math.max(0, Number(
    source.remaining_due ?? Math.max(total - paid, 0)
  ));

  const lines = [];

  if (source.start_time && source.end_time) {
    const formatTime = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    };
    const start = formatTime(source.start_time);
    const end = formatTime(source.end_time);
    if (start && end) lines.push(`Đặt từ ${start} đến ${end}`);
  }

  if (paid <= 0) {
    lines.push('Thanh toán: Chưa thanh toán');
  } else if (remaining > 0) {
    lines.push(`Đã cọc: ${formatBookingMoney(paid)}`);
    lines.push(`Còn lại: ${formatBookingMoney(remaining)}`);
  } else {
    lines.push(`Đã thanh toán: ${formatBookingMoney(paid || total)}`);
  }

  const note = String(source.booking_note || source.notes || '').trim();
  if (note) {
    lines.push(`Ghi chú: ${note}`);
  }

  return lines.join('\n');
}
