import { useEffect, useMemo, useState } from 'react';
import BookingCreateModal from '../../components/booking/BookingCreateModal';
import AppToast from '../../components/feedback/AppToast';
import PageBackButton from '../../components/navigation/PageBackButton';
import ScheduleCourtFilterBar from '../../components/schedule/ScheduleCourtFilterBar';
import ScheduleDateNavigator from '../../components/schedule/ScheduleDateNavigator';
import ScheduleLegend from '../../components/schedule/ScheduleLegend';
import ScheduleSlotCell from '../../components/schedule/ScheduleSlotCell';
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

  const [selectedCourtIds, setSelectedCourtIds] = useState([]);

  useEffect(() => {
    setSelectedCourtIds((current) => current.filter((courtId) => courts.some((court) => String(court.courtId) === String(courtId))));
  }, [courts]);

  const visibleIndexes = useMemo(() => {
    if (selectedCourtIds.length === 0) return courts.map((_, index) => index);
    const selected = new Set(selectedCourtIds.map(String));
    return courts.map((court, index) => ({ court, index })).filter(({ court }) => selected.has(String(court.courtId))).map(({ index }) => index);
  }, [courts, selectedCourtIds]);

  const visibleCourts = useMemo(() => visibleIndexes.map((index) => courts[index]), [courts, visibleIndexes]);
  const visibleGrid = useMemo(() => heatmapGrid.map((row) => ({ ...row, cells: visibleIndexes.map((index) => row.cells[index]) })), [heatmapGrid, visibleIndexes]);
  const courtFilterOptions = useMemo(() => courts.map((court) => ({ value: String(court.courtId), label: court.courtName, description: `Sân ${court.courtId}` })), [courts]);
  const courtSummary = selectedCourtIds.length === 0 ? 'Tất cả sân' : selectedCourtIds.length === 1 ? visibleCourts[0]?.courtName || '1 sân đã chọn' : `${selectedCourtIds.length} sân đã chọn`;

  return (
    <section className="panel admin-booking-desk-page">
      <div className="admin-booking-desk-header">
        <div>
          <h2>Quản lý đặt sân</h2>
          <p>Quản lý lịch sân, tạo booking và cập nhật booking đang hoạt động.</p>
        </div>
        <PageBackButton to="/admin" label="Quay lại Tổng quan" />
      </div>

      <AppToast message={message} />

      <article className="admin-booking-desk-card admin-booking-desk-heatmap">
        <ScheduleDateNavigator
          value={day}
          onChange={setDay}
          eyebrow="Lịch theo ngày"
          title="Bảng sân theo giờ"
          description="Bấm ô trống để đặt sân cho khách; bấm ô đã đặt để xem và xử lý booking."
        >
          <ScheduleCourtFilterBar
            options={courtFilterOptions}
            selectedValues={selectedCourtIds}
            onChange={setSelectedCourtIds}
            triggerLabel={courtSummary}
            visibleCourtCount={visibleCourts.length}
            totalCourtCount={courts.length}
            slotCount={heatmapGrid.length}
          />
        </ScheduleDateNavigator>

        <ScheduleLegend />

        <div className="heatmap-wrapper admin-booking-desk-heatmap-wrap">
          {visibleCourts.length === 0 ? (
            <p>Không có sân nào. Vui lòng chọn ngày khác.</p>
          ) : (
            <table className="heatmap">
              <thead>
                <tr>
                  <th className="time-header">Giờ</th>
                  {visibleCourts.map((court) => (
                    <th key={court.courtId} className="court-header">
                      <div className="court-header-content">
                        <strong>{court.courtName}</strong>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleGrid.map(({ time, label, cells }) => (
                  <tr key={time} className="heatmap-row">
                    <td className="time-cell">{label}</td>
                    {cells.map((slot, index) => {
                      if (!slot) {
                        return <ScheduleSlotCell key={`${time}-${index}`} slot={null} />;
                      }

                      const groupInfo = groupInfoBySlotId?.get?.(String(slot.id));
                      const group = bookingGroups.find((item) => item.groupKey === groupInfo?.groupKey);
                      const rangeText = group ? `${formatTime(group.start_time)} - ${formatTime(group.end_time)}` : '';

                      return (
                        <ScheduleSlotCell
                          key={slot.id || `${time}-${index}`}
                          slot={slot}
                          mode="manage"
                          selected={selectedBookingSlotIds?.has?.(String(slot.id)) || false}
                          onSelect={handleCellClick}
                          slotCount={groupInfo?.slotCount || 1}
                          rangeText={rangeText}
                          note={group?.booking_note?.trim() || ''}
                        />
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
        title="Đặt sân cho khách"
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
