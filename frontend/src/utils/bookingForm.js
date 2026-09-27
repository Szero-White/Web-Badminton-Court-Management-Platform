export const DEFAULT_BOOKING_COLOR = '#6f9f94';

export const BOOKING_COLOR_PALETTE = [
  '#6f9f94', '#7f9f7a', '#9aa36f', '#b29a73',
  '#b58a78', '#a98186', '#9a8398', '#838fa8',
  '#6f95a8', '#6f9ca0', '#779c8a', '#8e9b7c',
  '#a5947b', '#9c887c', '#8d8f97', '#77858a'
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Chưa thanh toán' },
  { value: 'partial', label: 'Cọc trước' },
  { value: 'paid', label: 'Thanh toán đủ' }
];

export function createBookingForm(overrides = {}) {
  return {
    day: '',
    courtId: '',
    startTimeSlotId: '',
    endTimeSlotId: 'single',
    rescheduleEndSlotId: '',
    rescheduleSlotIds: [],
    schedulePreviewTotal: 0,
    customerPhone: '',
    customerName: '',
    customerType: 'walk_in',
    notes: '',
    paymentStatus: 'unpaid',
    paymentAmount: '',
    paymentMethod: 'cash',
    paymentReference: '',
    paymentAdjustmentReason: '',
    displayColor: DEFAULT_BOOKING_COLOR,
    ...overrides
  };
}

export function paymentStatusFromTotals(paid, total) {
  const paidValue = Math.max(0, Number(paid || 0));
  const totalValue = Math.max(0, Number(total || 0));
  if (paidValue <= 0) return 'unpaid';
  if (totalValue > 0 && paidValue >= totalValue) return 'paid';
  return 'partial';
}

export function bookingGroupToForm(group) {
  const total = Number(group?.total_price || 0);
  const paid = Number(group?.deposit_paid || 0);
  const firstSlot = group?.slots?.[0] || null;
  const lastSlot = group?.slots?.[group?.slots?.length - 1] || firstSlot;
  const startDate = firstSlot?.start_time ? new Date(firstSlot.start_time) : null;
  const day = startDate && !Number.isNaN(startDate.getTime())
    ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    : '';

  return createBookingForm({
    day,
    courtId: String(group?.court_id || firstSlot?.court_id || ''),
    startTimeSlotId: firstSlot?.id ? String(firstSlot.id) : '',
    rescheduleEndSlotId: lastSlot?.id ? String(lastSlot.id) : '',
    rescheduleSlotIds: (group?.slots || []).map((slot) => Number(slot.id)),
    schedulePreviewTotal: total,
    customerPhone: group?.customer_phone || '',
    customerName: group?.customer_name || '',
    customerType: group?.customer_type || 'walk_in',
    notes: group?.booking_note || '',
    paymentStatus: paymentStatusFromTotals(paid, total),
    paymentAmount: paid > 0 ? String(paid) : '',
    displayColor: group?.display_color || DEFAULT_BOOKING_COLOR
  });
}

export function resolvePaymentTotal(form, totalPrice) {
  const total = Math.max(0, Math.round(Number(totalPrice || 0)));
  if (form.paymentStatus === 'paid') return total;
  if (form.paymentStatus === 'unpaid') return 0;
  const partial = Math.max(0, Math.round(Number(form.paymentAmount || 0)));
  return Math.min(partial, total);
}

export function allocatePaymentAcrossSlots(slots = [], totalPayment = 0) {
  let remaining = Math.max(0, Math.round(Number(totalPayment || 0)));
  return slots.map((slot) => {
    const cap = Math.max(0, Math.round(Number(slot.price || 0)));
    const value = Math.min(remaining, cap);
    remaining -= value;
    return value;
  });
}
