import BookingCreateModal from '../../components/booking/BookingCreateModal';
import AppToast from '../../components/feedback/AppToast';
import StaffCheckinPanel from './components/StaffCheckinPanel';
import StaffDepositEditor from './components/StaffDepositEditor';
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

      <AppToast message={vm.message} />

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

      <div className="staff-action-grid">
        <StaffCheckinPanel
          checkInCode={vm.checkInCode}
          setCheckInCode={vm.setCheckInCode}
          lastCheckin={vm.lastCheckin}
          checkinFeed={vm.checkinFeed}
          onSubmit={vm.doCheckin}
        />
        <StaffDepositEditor
          bookingGroups={vm.bookingGroups}
          selectedBooking={vm.selectedBooking}
          setSelectedBookingKey={vm.setSelectedBookingKey}
          depositEdit={vm.depositEdit}
          setDepositEdit={vm.setDepositEdit}
          loading={vm.loading}
          onConfirm={vm.confirmSelectedDeposit}
        />
      </div>

      <BookingCreateModal
        open={vm.bookingDialogOpen}
        title="Đặt sân cho khách"
        selectedSlot={vm.selectedStartSlot}
        day={vm.viewDay}
        endSlots={vm.endSlots}
        form={vm.bookingForm}
        setForm={vm.setBookingForm}
        loading={vm.loading}
        onSubmit={vm.createBookingForCustomer}
        onClose={() => vm.setBookingDialogOpen(false)}
      />
    </section>
  );
}
