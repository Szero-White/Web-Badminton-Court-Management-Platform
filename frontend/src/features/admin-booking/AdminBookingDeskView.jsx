import { Link } from 'react-router-dom';
import BookingCreateModal from '../../components/booking/BookingCreateModal';
import ScheduleDateNavigator from '../../components/schedule/ScheduleDateNavigator';
import AppSelect from '../../components/ui/AppSelect';
import { formatTime } from '../../utils/dateTime';

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'walk_in', label: 'Khách vãng lai' },
  { value: 'monthly', label: 'Khách cố định theo tháng' }
];

export default function AdminBookingDeskView({ vm }) {
  const {
    day,
    setDay,
    loading,
    message,
    selectedSlot,
    selectedBookingKey,
    showBookingForm,
    setShowBookingForm,
    bookingData,
    setBookingData,
    bookingEditForm,
    setBookingEditForm,
    isEditingBooking,
    setIsEditingBooking,
    courts,
    heatmapGrid,
    bookingGroups,
    selectedBooking,
    selectedBookingSlotIds,
    groupInfoBySlotId,
    endSlots,
    handleCellClick,
    handleCreateBooking,
    handleUpdateBooking,
    handleDeleteBooking
  } = vm;

  return (
    <section className="panel admin-booking-desk-page">
      <div className="admin-booking-desk-header">
        <div>
          <h2>Quản lý đặt sân</h2>
          <p>Quản lý lịch sân, tạo booking và cập nhật booking đang hoạt động.</p>
        </div>
        <div className="admin-booking-desk-links">
          <Link to="/admin/booking-desk" className="staff-link-pill">Đặt sân</Link>
          <Link to="/admin" className="staff-link-pill">Tổng quan</Link>
        </div>
      </div>

      {message ? <p className="message" role="status">{message}</p> : null}

      <article className="admin-booking-desk-card admin-booking-desk-heatmap">
        <ScheduleDateNavigator
          value={day}
          onChange={setDay}
          title="Bảng sân theo giờ"
          description="Bấm ô trống để mở hộp đặt sân; bấm ô đã đặt để xem và chỉnh sửa booking."
        />

        <div className="heatmap-wrapper admin-booking-desk-heatmap-wrap">
          {courts.length === 0 ? (
            <p>Không có sân nào. Vui lòng chọn ngày khác.</p>
          ) : (
            <table className="heatmap">
              <thead>
                <tr>
                  <th className="time-header">Giờ</th>
                  {courts.map((court) => (
                    <th key={court.courtId} className="court-header">
                      <div className="court-header-content">
                        <strong>{court.courtName}</strong>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapGrid.map(({ time, label, cells }) => (
                  <tr key={time} className="heatmap-row">
                    <td className="time-cell">{label}</td>
                    {cells.map((slot, index) => {
                      const isSelected = selectedBookingSlotIds?.has?.(String(slot?.id)) || false;
                      if (!slot) {
                        return <td key={`${time}-${index}`} className="heatmap-cell empty">-</td>;
                      }

                      if (slot.booked) {
                        const customerTypeLabel = slot.customer_type === 'monthly' ? 'Khách tháng' : 'Khách vãng lai';
                        const groupInfo = groupInfoBySlotId?.get?.(String(slot.id));
                        const group = bookingGroups.find((item) => item.groupKey === groupInfo?.groupKey);
                        const slotCount = groupInfo?.slotCount || 1;
                        const note = group?.booking_note?.trim() || '';

                        return (
                          <td
                            key={slot.id}
                            className={`heatmap-cell booked ${slot.customer_type === 'monthly' ? 'customer-monthly' : 'customer-walkin'} ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => handleCellClick(slot)}
                          >
                            <div className="cell-content">
                              <span className="booking-code">{slot.customer_name || 'Khách'}</span>
                              <span className="booking-time">{customerTypeLabel}</span>
                              <span className="booking-time">
                                {slot.booking_code || 'Booking'}{slotCount > 1 ? ` · ${slotCount} slot` : ''}
                              </span>
                              {note ? <span className="booking-note-preview" title={note}>{note}</span> : null}
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={slot.id} className="heatmap-cell free">
                          <button type="button" className="cell-button" onClick={() => handleCellClick(slot)}>
                            <span className="cell-price">{Number(slot.price || 0).toLocaleString('vi-VN')}</span>
                            <span className="cell-label">Đặt</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>

      {isEditingBooking && selectedBooking ? (
        <article className="admin-booking-desk-card admin-booking-edit-panel">
          <div className="admin-booking-edit-heading">
            <div>
              <span className="admin-booking-edit-eyebrow">Booking đang chọn</span>
              <h3>Chỉnh sửa booking</h3>
              <p>{selectedBooking.booking_code}</p>
            </div>
            <button type="button" className="operation-secondary-action" onClick={() => setIsEditingBooking(false)} disabled={loading}>
              Đóng
            </button>
          </div>

          <div className="admin-booking-edit-summary">
            <article><span>Sân</span><strong>{selectedBooking.court_name}</strong></article>
            <article><span>Thời gian</span><strong>{formatTime(selectedBooking.start_time)} - {formatTime(selectedBooking.end_time)}</strong></article>
            <article><span>Số slot</span><strong>{selectedBooking.slots?.length || 1}</strong></article>
            <article><span>Cọc hiện tại</span><strong>{Number(bookingEditForm.deposit || 0).toLocaleString('vi-VN')} VND</strong></article>
          </div>

          <div className="admin-booking-desk-edit operation-form">
            <label className="operation-field">
              <span>Tên khách</span>
              <input
                type="text"
                value={bookingEditForm.customerName}
                onChange={(event) => setBookingEditForm((current) => ({ ...current, customerName: event.target.value }))}
                disabled={loading}
              />
            </label>

            <label className="operation-field">
              <span>Số điện thoại</span>
              <input
                type="tel"
                value={bookingEditForm.customerPhone}
                onChange={(event) => setBookingEditForm((current) => ({ ...current, customerPhone: event.target.value }))}
                disabled={loading}
              />
            </label>

            <div className="operation-field">
              <span>Loại khách</span>
              <AppSelect
                value={bookingEditForm.customerType}
                onChange={(value) => setBookingEditForm((current) => ({ ...current, customerType: value }))}
                options={CUSTOMER_TYPE_OPTIONS}
                disabled={loading}
                ariaLabel="Loại khách"
              />
            </div>

            <label className="operation-field">
              <span>Tiền cọc (VND)</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={bookingEditForm.deposit}
                onChange={(event) => setBookingEditForm((current) => ({ ...current, deposit: Number(event.target.value) || 0 }))}
                disabled={loading}
              />
            </label>

            <label className="operation-field wide">
              <span>Ghi chú</span>
              <textarea
                value={bookingEditForm.notes}
                onChange={(event) => setBookingEditForm((current) => ({ ...current, notes: event.target.value }))}
                rows="3"
                disabled={loading}
              />
            </label>
          </div>

          <div className="admin-booking-edit-actions">
            <button type="button" onClick={handleUpdateBooking} disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
            <button type="button" className="operation-secondary-action" onClick={() => setIsEditingBooking(false)} disabled={loading}>
              Hủy
            </button>
            <button type="button" className="admin-booking-delete-action" onClick={handleDeleteBooking} disabled={loading}>
              Xóa booking
            </button>
          </div>
        </article>
      ) : null}

      <BookingCreateModal
        open={showBookingForm}
        title="Đặt sân mới"
        selectedSlot={selectedSlot}
        day={day}
        endSlots={endSlots}
        form={bookingData}
        setForm={setBookingData}
        loading={loading}
        onSubmit={handleCreateBooking}
        onClose={() => setShowBookingForm(false)}
      />
    </section>
  );
}
