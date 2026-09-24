export function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('vi-VN');
}

export function paymentMethodLabel(value) {
  return value === 'transfer' ? 'chuyển khoản' : 'tiền mặt';
}

export function buildDepositNote(existingNote, amount, method, reference) {
  const base = (existingNote || '').trim();
  const parts = [`Cọc: ${formatMoney(amount)} VND (${paymentMethodLabel(method)})`];
  if (reference?.trim()) parts.push(`Mã GD: ${reference.trim()}`);
  return [base, parts.join(' | ')].filter(Boolean).join(' | ');
}

export function getDepositPreviewByAmount(amount) {
  const paid = Number(amount || 0);
  return Number.isFinite(paid) && paid > 0 ? `Cọc: ${formatMoney(paid)} VND` : '';
}
