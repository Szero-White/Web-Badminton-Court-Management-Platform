import BookingModal from '../../components/booking/BookingModal';
import AppToast from '../../components/feedback/AppToast';
import StaffCheckinPanel from './components/StaffCheckinPanel';
import StaffScheduleBoard from './components/StaffScheduleBoard';

export default function StaffOperationsView({ vm }) {
  return (
    <section className="panel staff-page">
      <div className="staff-hero">
        <div>
          <h2>Quản lý đặt sân</h2>
          <p>Quản lý lịch sân, tạo booking và cập nhật booking đang hoạt động.</p>
        </div>
      </div>

      <AppToast message={vm.message} onDismiss={vm.clearNotice} />

      <StaffScheduleBoard
        viewDay={vm.viewDay}
        setViewDay={vm.setViewDay}
        courtColumns={vm.courtColumns}
        heatmapGrid={vm.heatmapGrid}
        bookingGroups={vm.bookingGroups}
        selectedBookingSlotIds={vm.selectedBookingSlotIds}
        groupInfoBySlotId={vm.groupInfoBySlotId}
        onCellClick={vm.handleDeskCellClick}
      />

      <div className="staff-action-grid staff-action-grid--single">
        <StaffCheckinPanel
          checkInCode={vm.checkInCode}
          setCheckInCode={vm.setCheckInCode}
          lastCheckin={vm.lastCheckin}
          checkinFeed={vm.checkinFeed}
          onSubmit={vm.doCheckin}
        />
      </div>

      <BookingModal
        open={vm.bookingDialogOpen}
        mode={vm.bookingDialogMode}
        selectedSlot={vm.selectedStartSlot}
        bookingGroup={vm.selectedBooking}
        day={vm.viewDay}
        endSlots={vm.endSlots}
        form={vm.bookingForm}
        setForm={vm.setBookingForm}
        loading={vm.loading}
        onSubmit={vm.bookingDialogMode === 'edit' ? vm.updateSelectedBooking : vm.createBookingForCustomer}
        onDelete={vm.bookingDialogMode === 'edit' ? vm.cancelSelectedBooking : undefined}
        loadDaySlots={vm.loadBookingScheduleSlots}
        feedback={vm.message?.tone === 'error' || vm.message?.tone === 'warning' ? vm.message : null}
        onValidationError={vm.notifyError}
        onClose={() => { vm.clearNotice?.(); vm.setBookingDialogOpen(false); }}
      />
    </section>
  );
}
