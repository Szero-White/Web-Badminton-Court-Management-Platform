import { Link } from 'react-router-dom';
import { formatTime } from '../../utils/dateTime';

export default function AdminBookingDeskView({ vm }) {
  const { day, setDay, slots, loading, message, selectedSlot, setSelectedSlot, selectedBookingKey, setSelectedBookingKey, showBookingForm, setShowBookingForm, bookingData, setBookingData, bookingEditForm, setBookingEditForm, isEditingBooking, setIsEditingBooking, courts, heatmapGrid, bookingGroups, selectedBooking, selectedBookingSlotIds, groupInfoBySlotId, loadData, handleCellClick, handleCreateBooking, handleUpdateBooking, handleDeleteBooking } = vm;
  return (
    <section className="panel admin-booking-desk-page">
      <div className="admin-booking-desk-header">
        <div>
          <h2>Quản lý đặt sân</h2>
          <p>Quản lý đặt sân và chỉnh sửa booking</p>
        </div>
        <div className="admin-booking-desk-links">
          <Link to="/admin/booking-desk" className="staff-link-pill">Đặt sân</Link>
          <Link to="/admin" className="staff-link-pill">Tổng quan</Link>
        </div>
      </div>

      <div className="admin-booking-desk-day">
        <label>
          <span>Ngày làm việc</span>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <button type="button" onClick={loadData} disabled={loading}>
          {loading ? 'Đang tải...' : 'Xem'}
        </button>
      </div>

      {message && <p className="message">{message}</p>}

      <article className="admin-booking-desk-card admin-booking-desk-heatmap">
        <div className="admin-booking-desk-heatmap-head">
          <h3>Bảng sân theo giờ</h3>
          <p>Bấm ô trống để đặt sân, bấm ô đã đặt để xem chi tiết</p>
        </div>

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
                    {cells.map((slot, idx) => {
                      const isSelected = selectedBookingSlotIds?.has?.(String(slot?.id)) || false;
                      if (!slot) {
                        return <td key={`${time}-${idx}`} className="heatmap-cell empty">-</td>;
                      }
                      if (slot.booked) {
                        const customerTypeLabel = slot.customer_type === 'monthly' ? 'Khách tháng' : 'Khách vãng lai';
                        const groupInfo = groupInfoBySlotId?.get?.(String(slot.id));
                        const slotCount = groupInfo?.slotCount || 1;
                        // Get the group to show consolidated time
                        const group = bookingGroups.find(g => g.groupKey === groupInfo?.groupKey);
                        // Build consolidated note: "Đặt từ XX đến YY | Ghi chú: ..."
                        let noteText = '';
                        if (group) {
                          const start = formatTime(group.start_time);
                          const end = formatTime(group.end_time);
                          const note = group.booking_note || '';
                          // Remove time info from note if it exists (to avoid duplication)
                          const cleanNote = note.replace(/Đặt từ \d{2}:\d{2} đến \d{2}:\d{2}\s*\|?\s*/g, '').trim();
                          if (cleanNote && !cleanNote.startsWith('Ghi chú')) {
                            noteText = `Đặt từ ${start} đến ${end} | Ghi chú: ${cleanNote}`;
                          } else if (cleanNote) {
                            noteText = `Đặt từ ${start} đến ${end} | ${cleanNote}`;
                          } else {
                            noteText = `Đặt từ ${start} đến ${end}`;
                          }
                        }
                        return (
                          <td
                            key={slot.id || `${time}-${idx}`}
                            className={`heatmap-cell booked ${slot.customer_type === 'monthly' ? 'customer-monthly' : 'customer-walkin'} ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => handleCellClick(slot)}
                          >
                            <div className="cell-content">
                              <span className="booking-code">{slot.customer_name || 'Khách'}</span>
                              <span className="booking-time">{customerTypeLabel}</span>
                              <span className="booking-time">
                                {slot.booking_code || 'Booking'}
                                {slotCount > 1 && <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.8 }}>({slotCount} slot)</span>}
                                {noteText && <span style={{ marginLeft: '4px' }}>📝</span>}
                              </span>
                              {noteText && <span style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{noteText}</span>}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={slot.id || `${time}-${idx}`} className="heatmap-cell free">
                          <button className="cell-button" onClick={() => handleCellClick(slot)}>
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

      {showBookingForm && selectedSlot && (
        <article className="admin-booking-desk-card" style={{ background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '24px', marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #e2e8f0' }}>
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>➕</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>Đặt sân mới</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>{selectedSlot.court_name} | {formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}</p>
            </div>
          </div>

          <form onSubmit={handleCreateBooking}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tên khách *</span>
                <input
                  type="text"
                  value={bookingData.customerName}
                  onChange={(e) => setBookingData({...bookingData, customerName: e.target.value})}
                  required
                  style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Số điện thoại *</span>
                <input
                  type="tel"
                  value={bookingData.customerPhone}
                  onChange={(e) => setBookingData({...bookingData, customerPhone: e.target.value})}
                  required
                  style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Loại khách</span>
                <select
                  value={bookingData.customerType}
                  onChange={(e) => setBookingData({...bookingData, customerType: e.target.value})}
                  style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white', cursor: 'pointer' }}
                >
                  <option value="walk_in">👤 Khách vãng lai</option>
                  <option value="monthly">⭐ Khách tháng</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tiền cọc (VND)</span>
                <input
                  type="number"
                  value={bookingData.deposit}
                  onChange={(e) => setBookingData({...bookingData, deposit: e.target.value})}
                  min="0"
                  style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white' }}
                />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ghi chú</span>
              <textarea
                value={bookingData.notes}
                onChange={(e) => setBookingData({...bookingData, notes: e.target.value})}
                rows="2"
                style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', resize: 'vertical', background: 'white' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '2px solid #e2e8f0' }}>
              <button 
                type="submit" 
                disabled={loading}
                style={{ flex: 1, padding: '12px 24px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
              >
                {loading ? '⏳ Đang xử lý...' : '✅ Xác nhận đặt'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowBookingForm(false)}
                disabled={loading}
                style={{ padding: '12px 24px', background: '#f1f5f9', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                ✕ Hủy
              </button>
            </div>
          </form>
        </article>
      )}

      {isEditingBooking && selectedBooking && (
        <article className="admin-booking-desk-card admin-booking-edit-panel" style={{ background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #e2e8f0' }}>
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>✏️</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>Chỉnh sửa booking</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>{selectedBooking.booking_code}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px', padding: '16px', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🏸</span>
              <div>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sân</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{selectedBooking.court_name}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🕐</span>
              <div>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Thời gian</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{formatTime(selectedBooking.start_time)} - {formatTime(selectedBooking.end_time)}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📊</span>
              <div>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Số slot</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{selectedBooking.slots?.length || 1} slot</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>💰</span>
              <div>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cọc hiện tại</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#059669' }}>{bookingEditForm.deposit.toLocaleString('vi-VN')} VND</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tên khách</span>
              <input
                type="text"
                value={bookingEditForm.customerName}
                onChange={(e) => setBookingEditForm((prev) => ({ ...prev, customerName: e.target.value }))}
                disabled={loading}
                style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', transition: 'all 0.2s', background: 'white' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Số điện thoại</span>
              <input
                type="tel"
                value={bookingEditForm.customerPhone}
                onChange={(e) => setBookingEditForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                disabled={loading}
                style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', transition: 'all 0.2s', background: 'white' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Loại khách</span>
              <select
                value={bookingEditForm.customerType}
                onChange={(e) => setBookingEditForm((prev) => ({ ...prev, customerType: e.target.value }))}
                disabled={loading}
                style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white', cursor: 'pointer' }}
              >
                <option value="walk_in">👤 Khách vãng lai</option>
                <option value="monthly">⭐ Khách tháng</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ghi chú</span>
              <textarea
                value={bookingEditForm.notes}
                onChange={(e) => setBookingEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows="1"
                disabled={loading}
                style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', resize: 'vertical', minHeight: '45px', background: 'white' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                💰 Tiền cọc (VND)
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                value={bookingEditForm.deposit}
                onChange={(e) => setBookingEditForm((prev) => ({ ...prev, deposit: Number(e.target.value) || 0 }))}
                disabled={loading}
                style={{ padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', transition: 'all 0.2s', background: 'white' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingTop: '16px', borderTop: '2px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={handleUpdateBooking}
              disabled={loading}
              style={{ flex: 1, padding: '12px 24px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
            >
              {loading ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditingBooking(false)}
              disabled={loading}
              style={{ padding: '12px 20px', background: '#f1f5f9', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              ✕ Hủy
            </button>
            <button
              type="button"
              onClick={handleDeleteBooking}
              disabled={loading}
              style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginLeft: 'auto', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
            >
              🗑️ Xóa
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
