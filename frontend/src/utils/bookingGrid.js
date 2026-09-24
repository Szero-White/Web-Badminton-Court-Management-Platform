import { formatTime, timeKey } from './dateTime';

export function compareSlotTime(a, b) {
  const diff = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  return diff || Number(a.court_id || 0) - Number(b.court_id || 0);
}

export function compareCourtThenTime(a, b) {
  return Number(a.court_id || 0) - Number(b.court_id || 0) || compareSlotTime(a, b);
}

export function makeBookingGroupKey(slot) {
  if (!slot?.start_time) return '';
  return `${slot.court_id}|${slot.customer_phone || slot.customer_name || ''}`;
}

export function groupBookedSlots(bookedSlots = []) {
  const sorted = [...bookedSlots].sort((a, b) => {
    const courtDiff = Number(a.court_id || 0) - Number(b.court_id || 0);
    if (courtDiff) return courtDiff;
    const customerA = a.customer_phone || a.customer_name || '';
    const customerB = b.customer_phone || b.customer_name || '';
    return customerA.localeCompare(customerB) || compareSlotTime(a, b);
  });

  const groups = [];
  for (const slot of sorted) {
    const identity = makeBookingGroupKey(slot);
    const current = groups.at(-1);
    const gap = current ? new Date(slot.start_time).getTime() - new Date(current.end_time).getTime() : Number.POSITIVE_INFINITY;
    if (current && current.identity === identity && gap >= 0 && gap <= 3600000) {
      current.slots.push(slot);
      current.booking_ids.push(slot.booking_id);
      current.time_slot_ids.push(slot.id);
      current.slot_count += 1;
      current.total_price += Number(slot.price || 0);
      current.deposit_paid += Number(slot.deposit_paid || 0);
      current.remaining_due += Number(slot.remaining_due || 0);
      current.end_time = slot.end_time;
      current.booking_code ||= slot.booking_code;
      current.booking_note ||= slot.booking_note;
      continue;
    }
    groups.push({
      identity,
      groupKey: `${identity}|${slot.start_time}`,
      court_id: slot.court_id,
      court_name: slot.court_name,
      court_names: [slot.court_name || `Sân ${slot.court_id}`],
      customer_name: slot.customer_name,
      customer_phone: slot.customer_phone,
      customer_type: slot.customer_type,
      booking_code: slot.booking_code,
      booking_note: slot.booking_note,
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: slot.status,
      total_price: Number(slot.price || 0),
      deposit_paid: Number(slot.deposit_paid || 0),
      remaining_due: Number(slot.remaining_due || 0),
      slot_count: 1,
      slots: [slot],
      booking_ids: [slot.booking_id],
      time_slot_ids: [slot.id]
    });
  }
  return groups.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

export function findBookingGroupForSlot(groups, slot) {
  if (!slot) return null;
  return groups.find((group) => group.slots?.some((item) => String(item.id) === String(slot.id))) || null;
}

export function buildHeatmapGrid(slots = [], courts = []) {
  const bands = new Map();
  const slotMap = new Map();
  for (const slot of slots) {
    const key = timeKey(slot.start_time);
    if (key && !bands.has(key)) bands.set(key, `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`);
    slotMap.set(`${slot.court_id}|${key}`, slot);
  }
  return [...bands.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([time, label]) => ({
    time,
    label,
    cells: courts.map((court) => slotMap.get(`${court.courtId}|${time}`) || null)
  }));
}
