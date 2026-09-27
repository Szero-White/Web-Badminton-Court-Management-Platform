import { useEffect, useMemo, useState } from 'react';
import BookingModal from '../../components/booking/BookingModal';
import AppToast from '../../components/feedback/AppToast';
import PageBackButton from '../../components/navigation/PageBackButton';
import ScheduleCourtFilterBar from '../../components/schedule/ScheduleCourtFilterBar';
import ScheduleDateNavigator from '../../components/schedule/ScheduleDateNavigator';
import ScheduleSlotCell from '../../components/schedule/ScheduleSlotCell';
import { formatTime } from '../../utils/dateTime';

export default function AdminBookingDeskView({ vm }) {
  const {
    day,
    setDay,
    loading,
    message,
    selectedSlot,
    bookingDialogOpen,
    setBookingDialogOpen,
    bookingDialogMode,
    bookingForm,
    setBookingForm,
    courts,
    heatmapGrid,
    bookingGroups,
    selectedBooking,
    selectedBookingSlotIds,
    groupInfoBySlotId,
    selectedStartSlot,
    endSlots,
    handleCellClick,
    handleCreateBooking,
    handleUpdateBooking,
    handleDeleteBooking,
    loadBookingScheduleSlots
  } = vm;

  const [selectedCourtIds, setSelectedCourtIds] = useState([]);

  useEffect(() => {
    setSelectedCourtIds((current) => current.filter((courtId) => courts.some((court) => String(court.courtId) === String(courtId))));
  }, [courts]);

  const visibleIndexes = useMemo(() => {
    if (selectedCourtIds.length === 0) return courts.map((_, index) => index);
    const selected = new Set(selectedCourtIds.map(String));
    return courts
      .map((court, index) => ({ court, index }))
      .filter(({ court }) => selected.has(String(court.courtId)))
      .map(({ index }) => index);
  }, [courts, selectedCourtIds]);

  const visibleCourts = useMemo(() => visibleIndexes.map((index) => courts[index]), [courts, visibleIndexes]);
  const visibleGrid = useMemo(
    () => heatmapGrid.map((row) => ({ ...row, cells: visibleIndexes.map((index) => row.cells[index]) })),
    [heatmapGrid, visibleIndexes]
  );
  const courtFilterOptions = useMemo(
    () => courts.map((court) => ({ value: String(court.courtId), label: court.courtName, description: `Sân ${court.courtId}` })),
    [courts]
  );
  const courtSummary = selectedCourtIds.length === 0
    ? 'Tất cả sân'
    : selectedCourtIds.length === 1
      ? visibleCourts[0]?.courtName || '1 sân đã chọn'
      : `${selectedCourtIds.length} sân đã chọn`;

  return (
    <section className="panel admin-booking-desk-page">
      <div className="admin-booking-desk-header">
        <div>
          <h2>Quản lý đặt sân</h2>
          <p>Quản lý lịch sân, tạo booking và cập nhật booking đang hoạt động.</p>
        </div>
        <PageBackButton to="/admin" label="Quay lại Tổng quan" />
      </div>

      <AppToast message={message} onDismiss={vm.clearNotice} />

      <article className="admin-booking-desk-card admin-booking-desk-heatmap">
        <ScheduleDateNavigator
          value={day}
          onChange={setDay}
          eyebrow="Lịch theo ngày"
          title="Bảng sân theo giờ"
          description="Bấm ô trống để đặt sân; bấm ô đã đặt để chỉnh sửa ngay trong cửa sổ booking."
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
                      if (!slot) return <ScheduleSlotCell key={`${time}-${index}`} slot={null} />;

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
                          bookingGroup={group}
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

      <BookingModal
        open={bookingDialogOpen}
        mode={bookingDialogMode}
        selectedSlot={selectedStartSlot || selectedSlot}
        bookingGroup={selectedBooking}
        day={day}
        endSlots={endSlots}
        form={bookingForm}
        setForm={setBookingForm}
        loading={loading}
        onSubmit={bookingDialogMode === 'edit' ? handleUpdateBooking : handleCreateBooking}
        onDelete={bookingDialogMode === 'edit' ? handleDeleteBooking : undefined}
        loadDaySlots={loadBookingScheduleSlots}
        feedback={message?.tone === 'error' || message?.tone === 'warning' ? message : null}
        onValidationError={vm.notifyError}
        onClose={() => { vm.clearNotice?.(); setBookingDialogOpen(false); }}
      />
    </section>
  );
}
