export function shiftLabel(shift) {
  if (shift === 'morning') return 'sáng';
  if (shift === 'afternoon') return 'chiều';
  return 'tối';
}

export function getShiftName(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export function getPreviousShift(shift) {
  if (shift === 'morning') return 'evening';
  if (shift === 'afternoon') return 'morning';
  return 'afternoon';
}
