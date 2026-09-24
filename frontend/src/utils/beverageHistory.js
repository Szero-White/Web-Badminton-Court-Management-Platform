const ACTION_LABELS = {
  beverage_update: 'Cập nhật mặt hàng',
  beverage_delete: 'Xóa mặt hàng',
  beverage_adjust_stock_increase: 'Tăng tồn kho',
  beverage_adjust_stock_decrease: 'Giảm tồn kho'
};

const FIELD_LABELS = {
  before_name: 'Tên cũ',
  after_name: 'Tên mới',
  name: 'Tên mặt hàng',
  before_price: 'Giá cũ',
  after_price: 'Giá mới',
  before_stock: 'Tồn cũ',
  after_stock: 'Tồn mới',
  before_unit: 'Đơn vị cũ',
  after_unit: 'Đơn vị mới',
  before_description: 'Mô tả cũ',
  after_description: 'Mô tả mới',
  before_active: 'Trạng thái cũ',
  after_active: 'Trạng thái mới',
  delta: 'Chênh lệch',
  note: 'Ghi chú'
};

export function getBeverageActionLabel(action) {
  return ACTION_LABELS[action] || action || 'Không xác định';
}

export function formatBeverageHistoryPayload(payload) {
  if (!payload) return '-';
  const values = {};
  payload.split(';').forEach((segment) => {
    const index = segment.indexOf('=');
    if (index < 0) return;
    const key = segment.slice(0, index).trim();
    const value = segment.slice(index + 1).trim();
    if (key) values[key] = value;
  });
  const parts = Object.keys(FIELD_LABELS)
    .filter((key) => values[key] !== undefined && values[key] !== '')
    .map((key) => `${FIELD_LABELS[key]}: ${values[key]}`);
  return parts.length ? parts.join(' | ') : payload;
}
