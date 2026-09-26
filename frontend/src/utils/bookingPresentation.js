const BOOKING_STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
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
