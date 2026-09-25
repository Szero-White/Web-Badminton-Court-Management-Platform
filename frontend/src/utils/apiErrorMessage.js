const EXACT_MESSAGES = new Map([
  ['cannot book a past time slot', 'Không thể đặt sân cho khung giờ đã qua.'],
  ['slot already held by another user', 'Khung giờ này đang được người khác giữ chỗ.'],
  ['slot already booked', 'Khung giờ này đã được đặt.'],
  ['court is not available', 'Sân hiện không khả dụng.'],
  ['start and end slot are required', 'Vui lòng chọn giờ bắt đầu và giờ kết thúc.'],
  ['start and end slot must be on the same court', 'Giờ bắt đầu và giờ kết thúc phải thuộc cùng một sân.'],
  ['end time must be after start time', 'Giờ kết thúc phải sau giờ bắt đầu.'],
  ['no slots found in selected range', 'Không tìm thấy khung giờ phù hợp trong khoảng đã chọn.'],
  ['booking cannot be updated', 'Booking hiện không thể cập nhật.'],
  ['selected court is not available', 'Sân đã chọn hiện không khả dụng.'],
  ['selected slot is already booked', 'Khung giờ đã chọn đã được đặt.'],
  ['booking cannot be canceled', 'Booking hiện không thể hủy.'],
  ['booking cannot be checked in', 'Booking hiện chưa thể check-in.'],
  ['booking hold has expired', 'Thời gian giữ chỗ của booking đã hết.'],
  ['deposit amount must be greater than zero', 'Số tiền cọc phải lớn hơn 0.'],
  ['payment method is required', 'Vui lòng chọn phương thức thanh toán.'],
  ['booking cannot receive deposit in current status', 'Trạng thái booking hiện tại không cho phép nhận cọc.'],
  ['phone is required', 'Vui lòng nhập số điện thoại.'],
  ['booking code or phone is required', 'Vui lòng nhập mã booking hoặc số điện thoại.'],
  ['booking access denied', 'Bạn không có quyền truy cập booking này.'],
  ['invalid credentials', 'Email hoặc mật khẩu không đúng.'],
  ['invalid refresh token', 'Phiên đăng nhập không còn hợp lệ.'],
  ['invalid token type', 'Phiên đăng nhập không hợp lệ.'],
  ['invalid subject', 'Thông tin phiên đăng nhập không hợp lệ.'],
  ['invalid staff id', 'Mã nhân viên không hợp lệ.'],
  ['invalid booking_id', 'Mã booking không hợp lệ.'],
  ['invalid court_id', 'Mã sân không hợp lệ.'],
  ['invalid beverage_id', 'Mã mặt hàng không hợp lệ.'],
  ['invalid day format', 'Ngày không đúng định dạng.'],
  ['day is required (YYYY-MM-DD)', 'Vui lòng chọn ngày.'],
  ['time_slot_id or start/end slot ids are required', 'Vui lòng chọn khung giờ đặt sân.'],
  ['quantity must be greater than 0', 'Số lượng phải lớn hơn 0.'],
  ['insufficient stock', 'Số lượng tồn kho không đủ.'],
  ['beverage is inactive', 'Mặt hàng hiện đang ngừng bán.'],
  ['payment_method must be cash or transfer', 'Phương thức thanh toán phải là tiền mặt hoặc chuyển khoản.'],
  ['stock would become negative', 'Số lượng tồn kho không thể nhỏ hơn 0.'],
  ['delta must not be 0', 'Số lượng điều chỉnh phải khác 0.'],
  ['name must not be empty', 'Tên không được để trống.'],
  ['unit must not be empty', 'Đơn vị không được để trống.'],
  ['price must be >= 0', 'Giá bán phải lớn hơn hoặc bằng 0.'],
  ['stock must be >= 0', 'Tồn kho phải lớn hơn hoặc bằng 0.'],
  ['beverage already deleted', 'Mặt hàng này đã được xóa.']
]);

const DYNAMIC_MESSAGES = [
  {
    pattern: /^slot\s+(.+)\s+is already booked$/i,
    format: (match) => `Khung giờ ${match[1]} đã được đặt.`
  },
  {
    pattern: /^deposit amount cannot exceed remaining due \((.+)\)$/i,
    format: (match) => `Số tiền cọc không được vượt quá số tiền còn lại (${match[1]}).`
  },
  {
    pattern: /^password must be at least (\d+) characters$/i,
    format: (match) => `Mật khẩu phải có ít nhất ${match[1]} ký tự.`
  }
];

export function localizeApiMessage(message) {
  if (typeof message !== 'string' || !message.trim()) {
    return message;
  }

  const normalized = message.trim();
  const exact = EXACT_MESSAGES.get(normalized);
  if (exact) {
    return exact;
  }

  for (const entry of DYNAMIC_MESSAGES) {
    const match = normalized.match(entry.pattern);
    if (match) {
      return entry.format(match);
    }
  }

  return message;
}
