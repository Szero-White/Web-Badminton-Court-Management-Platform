import { Link } from 'react-router-dom';
import StaffBookingForm from './components/StaffBookingForm';
import StaffCheckinPanel from './components/StaffCheckinPanel';
import StaffDepositEditor from './components/StaffDepositEditor';
import StaffScheduleBoard from './components/StaffScheduleBoard';

export default function StaffOperationsView({ vm }) {
  return (
    <section className="panel staff-page">
      <div className="staff-hero">
        <div><h2>Nhân viên</h2></div>
        <div className="staff-quick-links">
          <Link to="/staff/beverage-counter" className="staff-link-pill">Bán và nhập nước</Link>
          <Link to="/staff/transactions" className="staff-link-pill">Sổ thu chi ca</Link>
        </div>
      </div>

      {vm.message ? <p className="message staff-message" role="status">{vm.message}</p> : null}

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
        <StaffBookingForm
          bookingForm={vm.bookingForm}
          setBookingForm={vm.setBookingForm}
          groupedSlotsByCourt={vm.groupedSlotsByCourt}
          selectedStartSlot={vm.selectedStartSlot}
          endSlots={vm.endSlots}
          loadSlots={vm.loadSlots}
          onSubmit={vm.createBookingForCustomer}
        />
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

      <div className="staff-footer-actions">
        <Link to="/staff/beverage-counter" className="staff-link-secondary">Mở bảng bán/nhập nước</Link>
        <Link to="/staff/transactions" className="staff-link-secondary">Mở sổ thu chi ca</Link>
      </div>
    </section>
  );
}
