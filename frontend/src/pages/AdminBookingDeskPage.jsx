import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingApi, staffApi } from '../services/api';
import './AdminBookingDeskPage.css';

// Helper functions
function formatDayInput(date = new Date()) {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 10);
}

function timeKey(isoTime) {
  try {
    const d = new Date(isoTime);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch (e) {
    return '';
  }
}

function formatTime(isoTime) {
  try {
    const d = new Date(isoTime);
    if (isNaN(d.getTime())) return '--:--';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch (e) {
    return '--:--';
  }
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('vi-VN');
}

function compareSlotTime(a, b) {
  try {
    const timeA = new Date(a.start_time).getTime();
    const timeB = new Date(b.start_time).getTime();
    if (isNaN(timeA) || isNaN(timeB)) return 0;
    const diff = timeA - timeB;
    if (diff !== 0) return diff;
    return Number(a.court_id || 0) - Number(b.court_id || 0);
  } catch (e) {
    return 0;
  }
}

function makeBookingGroupKey(slot) {
  if (!slot || !slot.start_time) return '';
  // Group by court + customer, ignore booking_code to group consecutive slots
  return [
    slot.court_id,
    slot.customer_phone || slot.customer_name || ''
  ].join('|');
}

function groupBookedSlots(bookedSlots) {
  const grouped = new Map();
  // Sort by court_id, then by customer, then by time
  const sorted = [...bookedSlots].sort((a, b) => {
    const courtCompare = Number(a.court_id) - Number(b.court_id);
    if (courtCompare !== 0) return courtCompare;
    const customerA = a.customer_phone || a.customer_name || '';
    const customerB = b.customer_phone || b.customer_name || '';
    if (customerA !== customerB) return customerA.localeCompare(customerB);
    return compareSlotTime(a, b);
  });

  let currentGroup = null;
  let currentGroupKey = '';

  sorted.forEach((slot) => {
    const groupKey = makeBookingGroupKey(slot);
    if (!groupKey) return;

    // Check if this slot continues from the previous slot in the same group
    // (within 1 hour of the previous slot's end time)
    if (currentGroup && currentGroupKey === groupKey && currentGroup.slots.length > 0) {
      const lastSlot = currentGroup.slots[currentGroup.slots.length - 1];
      const lastEndTime = new Date(lastSlot.end_time).getTime();
      const thisStartTime = new Date(slot.start_time).getTime();
      const timeGap = thisStartTime - lastEndTime; // in milliseconds
      
      // If gap is small (less than 1 hour), it's the same continuous booking
      if (timeGap <= 60 * 60 * 1000) { // 1 hour in ms
        currentGroup.slots.push(slot);
        // Use the latest booking_code and note
        currentGroup.booking_code = slot.booking_code || currentGroup.booking_code;
        if (slot.booking_note && !currentGroup.booking_note) {
          currentGroup.booking_note = slot.booking_note;
        }
        // Update end time
        if (new Date(slot.end_time) > new Date(currentGroup.end_time)) {
          currentGroup.end_time = slot.end_time;
        }
        return;
      }
    }

    // Start a new group
    const newGroup = {
      groupKey,
      court_id: slot.court_id,
      court_name: slot.court_name,
      customer_name: slot.customer_name,
      customer_phone: slot.customer_phone,
      customer_type: slot.customer_type,
      booking_code: slot.booking_code,
      booking_note: slot.booking_note,
      start_time: slot.start_time,
      end_time: slot.end_time,
      slots: [slot]
    };
    grouped.set(groupKey + '_' + slot.start_time, newGroup); // Unique key with timestamp
    currentGroup = newGroup;
    currentGroupKey = groupKey;
  });

  return [...grouped.values()];
}

function buildHeatmapGrid(slots, courts) {
  const timeBands = [];
  const startKeys = new Set();

  slots.forEach((slot) => {
    const startKey = timeKey(slot.start_time);
    if (!startKey || startKeys.has(startKey)) return;
    startKeys.add(startKey);
    timeBands.push({
      startKey,
      label: `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`
    });
  });

  timeBands.sort((a, b) => a.startKey.localeCompare(b.startKey));

  const slotMap = new Map();
  slots.forEach((slot) => {
    const key = `${slot.court_id}|${timeKey(slot.start_time)}`;
    slotMap.set(key, slot);
  });

  return timeBands.map(({ startKey, label }) => ({
    time: startKey,
    label,
    cells: courts.map((court) => slotMap.get(`${court.courtId}|${startKey}`) || null)
  }));
}

export default function AdminBookingDeskPage() {
  const [day, setDay] = useState(formatDayInput());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedBookingKey, setSelectedBookingKey] = useState(null);

  // Booking form state
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    customerName: '',
    customerPhone: '',
    customerType: 'walk_in',
    notes: '',
    deposit: 0
  });

  // Booking edit form
  const [bookingEditForm, setBookingEditForm] = useState({
    customerName: '',
    customerPhone: '',
    customerType: 'walk_in',
    notes: '',
    deposit: 0
  });
  const [isEditingBooking, setIsEditingBooking] = useState(false);

  // Group slots by court
  const courts = useMemo(() => {
    const map = new Map();
    slots.forEach(slot => {
      if (!map.has(slot.court_id)) {
        map.set(slot.court_id, {
          courtId: slot.court_id,
          courtName: slot.court_name || `Sân ${slot.court_id}`
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => Number(a.courtId) - Number(b.courtId));
  }, [slots]);

  const heatmapGrid = useMemo(() => buildHeatmapGrid(slots, courts), [slots, courts]);

  const bookingGroups = useMemo(
    () => groupBookedSlots(slots.filter((slot) => slot.booked)),
    [slots]
  );

  const selectedBooking = useMemo(
    () => bookingGroups.find((group) => group.groupKey === selectedBookingKey) || null,
    [bookingGroups, selectedBookingKey]
  );

  const selectedBookingSlotIds = useMemo(
    () => new Set(selectedBooking?.slots?.map((s) => String(s.id)) || []),
    [selectedBooking]
  );

  const groupInfoBySlotId = useMemo(() => {
    const map = new Map();
    bookingGroups.forEach((group) => {
      const slotCount = group.slots?.length || 1;
      const totalDeposit = group.slots?.reduce((sum, s) => sum + (s.deposit_paid || 0), 0) || 0;
      const hasNote = !!group.booking_note;
      group.slots?.forEach((slot) => {
        map.set(String(slot.id), {
          deposit: totalDeposit,
          note: group.booking_note,
          slotCount,
          hasNote,
          groupKey: group.groupKey
        });
      });
    });
    return map;
  }, [bookingGroups]);

  function getDepositPreviewByAmount(amount) {
    const paid = Number(amount || 0);
    if (paid > 0) {
      return `Cọc: ${paid.toLocaleString('vi-VN')} VND`;
    }
    return '';
  }

  async function loadData() {
    setLoading(true);
    setMessage('');
    try {
      const res = await bookingApi.getDaySlots(day);
      const data = res.data?.data || [];
      setSlots(data);
      setMessage(`Đã tải ${data.length} slot cho ngày ${day}`);
    } catch (err) {
      console.error('Load error:', err);
      setMessage('Lỗi tải dữ liệu: ' + (err.response?.data?.error?.message || err.message));
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [day]);

  function handleCellClick(slot) {
    if (!slot) return;
    
    if (slot.booked) {
      // Select the entire booking group
      const groupKey = makeBookingGroupKey(slot);
      setSelectedBookingKey(groupKey);
      setSelectedSlot(slot);
      
      // Find group and open edit form
      const group = bookingGroups.find(g => g.groupKey === groupKey);
      if (group) {
        // Calculate total deposit from all slots
        const totalDeposit = group.slots?.reduce((sum, s) => sum + (s.deposit_paid || 0), 0) || 0;
        setBookingEditForm({
          customerName: group.customer_name || '',
          customerPhone: group.customer_phone || '',
          customerType: group.customer_type || 'walk_in',
          notes: group.booking_note || '',
          deposit: totalDeposit
        });
        setIsEditingBooking(true);
        
        // Scroll to edit panel
        setTimeout(() => {
          const editPanel = document.querySelector('.admin-booking-edit-panel');
          if (editPanel) {
            editPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    } else {
      setSelectedSlot(slot);
      setShowBookingForm(true);
      setBookingData({
        customerName: '',
        customerPhone: '',
        customerType: 'walk_in',
        notes: '',
        deposit: 0
      });
    }
  }

  async function handleCreateBooking(e) {
    e.preventDefault();
    if (!selectedSlot || !bookingData.customerName || !bookingData.customerPhone) {
      setMessage('Vui lòng nhập đủ tên và số điện thoại');
      return;
    }

    try {
      setLoading(true);
      await bookingApi.createForCustomer({
        time_slot_ids: [selectedSlot.id],
        customer_name: bookingData.customerName,
        customer_phone: bookingData.customerPhone,
        customer_type: bookingData.customerType,
        notes: bookingData.notes,
        deposit: Number(bookingData.deposit) || 0
      });
      setMessage('Đặt sân thành công!');
      setShowBookingForm(false);
      setSelectedSlot(null);
      loadData();
    } catch (err) {
      console.error('Booking error:', err);
      setMessage('Lỗi đặt sân: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateBooking() {
    if (!selectedBooking?.slots?.length) return;

    setLoading(true);
    try {
      // Calculate deposit per slot
      const targetDeposit = Math.round(Number(bookingEditForm.deposit) || 0);
      let remainingDeposit = targetDeposit;
      const slotCount = selectedBooking.slots.length;

      // Use plain note text only - explicitly clear old data
      const newNotes = bookingEditForm.notes || '';
      
      console.log('Updating booking with new data:', {
        customerName: bookingEditForm.customerName,
        customerPhone: bookingEditForm.customerPhone,
        customerType: bookingEditForm.customerType,
        notes: newNotes,
        totalDeposit: targetDeposit,
        slots: selectedBooking.slots.map(s => ({ id: s.id, booking_id: s.booking_id }))
      });

      // Update all bookings in the group - overwrite completely
      for (let i = 0; i < selectedBooking.slots.length; i++) {
        const slot = selectedBooking.slots[i];
        if (slot.booking_id) {
          const slotPrice = Math.round(Number(slot.price || 0));
          // For last slot, use remaining deposit to avoid rounding issues
          const slotDeposit = i === slotCount - 1 
            ? remainingDeposit 
            : Math.min(remainingDeposit, Math.max(0, slotPrice));
          
          // Force clear old data by explicitly setting all fields
          const updateData = {
            customer_name: bookingEditForm.customerName || '',
            customer_phone: bookingEditForm.customerPhone || '',
            customer_type: bookingEditForm.customerType || 'walk_in',
            notes: newNotes,
            deposit_total: slotDeposit,
            // Explicitly clear old fields that might contain stale data
            extra_data: null,
            metadata: null
          };
          
          console.log(`Updating slot ${i + 1}/${slotCount} (booking_id: ${slot.booking_id}):`, updateData);
          
          await staffApi.updateBooking(slot.booking_id, updateData);
          
          remainingDeposit -= slotDeposit;
        }
      }

      setMessage('✅ Đã cập nhật booking thành công. Đang tải lại dữ liệu...');
      
      // Clear edit form to prevent stale data
      setBookingEditForm({
        customerName: '',
        customerPhone: '',
        customerType: 'walk_in',
        notes: '',
        deposit: 0
      });
      setIsEditingBooking(false);
      
      // Wait longer for backend to process all slots then reload
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadData();
      setMessage('✅ Đã cập nhật và tải lại dữ liệu thành công. Dữ liệu cũ đã được xóa.');
    } catch (err) {
      console.error('Update booking error:', err);
      console.error('Error response:', err?.response?.data);
      setMessage('Lỗi: ' + (err?.response?.data?.error?.message || err?.message || 'Không cập nhật được booking.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBooking() {
    if (!selectedBooking?.slots?.length) return;

    const reason = window.prompt(`Nhập lý do xóa booking ${selectedBooking.booking_code}:`);
    if (reason === null) return;

    if (!window.confirm(`Bạn chắc chắn muốn xóa booking ${selectedBooking.booking_code}?\n\nSố slot sẽ bị xóa: ${selectedBooking.slots.length}`)) {
      return;
    }

    setLoading(true);
    try {
      console.log(`Deleting booking ${selectedBooking.booking_code} with ${selectedBooking.slots.length} slots`);
      
      // Delete all slots in the booking group
      for (let i = 0; i < selectedBooking.slots.length; i++) {
        const slot = selectedBooking.slots[i];
        if (slot.booking_id) {
          console.log(`Deleting slot ${i + 1}/${selectedBooking.slots.length} (booking_id: ${slot.booking_id})`);
          await staffApi.deleteBooking(slot.booking_id, reason || 'Admin xóa booking');
        }
      }

      setMessage('✅ Đã xóa booking thành công. Đang tải lại dữ liệu...');
      
      // Clear selection
      setSelectedBookingKey(null);
      setBookingEditForm({
        customerName: '',
        customerPhone: '',
        customerType: 'walk_in',
        notes: '',
        deposit: 0
      });
      setIsEditingBooking(false);
      
      // Wait for backend to process then reload
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadData();
      
      setMessage('✅ Đã xóa booking và cập nhật bảng dữ liệu thành công.');
    } catch (err) {
      console.error('Delete booking error:', err);
      console.error('Error response:', err?.response?.data);
      setMessage('Lỗi: ' + (err?.response?.data?.error?.message || err?.message || 'Không xóa được booking.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel admin-booking-desk-page">
      <div className="admin-booking-desk-header">
        <div>
          <h2>Booking Desk Admin</h2>
          <p>Quản lý đặt sân và chỉnh sửa booking</p>
        </div>
        <div className="admin-booking-desk-links">
          <Link to="/admin/booking-desk" className="staff-link-pill">Booking Desk</Link>
          <Link to="/admin" className="staff-link-pill">Dashboard</Link>
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
