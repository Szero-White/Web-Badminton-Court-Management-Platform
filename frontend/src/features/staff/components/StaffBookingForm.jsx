import { formatTime } from '../../../utils/dateTime';

export default function StaffBookingForm({
  bookingForm,
  setBookingForm,
  groupedSlotsByCourt,
  selectedStartSlot,
  endSlots,
  loadSlots,
  onSubmit
}) {
  const update = (field, value) => setBookingForm((current) => ({ ...current, [field]: value }));

  return (
    <article className="staff-action-card staff-action-card--wide">
      <h3>Đặt sân cho khách</h3>
      <p>Chọn ngày, khung giờ trống, nhập số điện thoại và tạo booking nhanh tại quầy.</p>
      <form className="staff-form staff-form--grid" onSubmit={onSubmit}>
        <input
          className="staff-form-full"
          type="date"
          value={bookingForm.day}
          onChange={(event) => {
            const day = event.target.value;
            setBookingForm((current) => ({ ...current, day, startTimeSlotId: '', endTimeSlotId: '' }));
            loadSlots(day);
          }}
        />
        <select value={bookingForm.startTimeSlotId} onChange={(event) => setBookingForm((current) => ({ ...current, startTimeSlotId: event.target.value, endTimeSlotId: '' }))}>
          <option value="">Chọn giờ bắt đầu</option>
          {groupedSlotsByCourt.map((group) => (
            <optgroup key={group.courtId} label={group.courtName}>
              {group.slots.map((slot) => (
                <option key={slot.id} value={slot.id} disabled={slot.booked}>
                  {formatTime(slot.start_time)} - {formatTime(slot.end_time)} | {Number(slot.price || 0).toLocaleString('vi-VN')} VND{slot.booked ? ' | Đã đặt' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select value={bookingForm.endTimeSlotId} onChange={(event) => update('endTimeSlotId', event.target.value)} disabled={!selectedStartSlot}>
          <option value="">Chọn giờ kết thúc</option>
          {endSlots.map((slot) => <option key={slot.id} value={slot.id}>{slot.court_name} | {formatTime(slot.start_time)}</option>)}
        </select>
        <input placeholder="Số điện thoại khách" value={bookingForm.customerPhone} onChange={(event) => update('customerPhone', event.target.value)} required />
        <input placeholder="Tên khách" value={bookingForm.customerName} onChange={(event) => update('customerName', event.target.value)} required />
        <select value={bookingForm.customerType} onChange={(event) => update('customerType', event.target.value)}>
          <option value="walk_in">Khách vãng lai</option>
          <option value="monthly">Khách cố định theo tháng</option>
        </select>
        <textarea className="staff-form-full" placeholder="Ghi chú thêm" value={bookingForm.notes} onChange={(event) => update('notes', event.target.value)} rows="2" />
        <label className="staff-form-full staff-deposit-toggle">
          <input type="checkbox" checked={bookingForm.collectDeposit} onChange={(event) => update('collectDeposit', event.target.checked)} />
          <span>Khách cọc trước</span>
        </label>
        {bookingForm.collectDeposit ? (
          <div className="staff-form-full staff-deposit-grid">
            <input type="number" min="0" step="1000" placeholder="Số tiền cọc" value={bookingForm.depositAmount} onChange={(event) => update('depositAmount', event.target.value)} />
            <select value={bookingForm.depositMethod} onChange={(event) => update('depositMethod', event.target.value)}>
              <option value="transfer">Chuyển khoản</option>
              <option value="cash">Tiền mặt</option>
            </select>
            <input placeholder="Mã giao dịch / ghi chú cọc" value={bookingForm.depositReference} onChange={(event) => update('depositReference', event.target.value)} />
          </div>
        ) : null}
        <button className="staff-form-full" type="submit">Tạo booking cho khách</button>
        {selectedStartSlot ? <p className="staff-form-full staff-form-hint">Đang chọn: {selectedStartSlot.court_name} | {formatTime(selectedStartSlot.start_time)} trở đi. Giờ kết thúc là mốc trả sân theo từng khung 30 phút.</p> : null}
      </form>
    </article>
  );
}
