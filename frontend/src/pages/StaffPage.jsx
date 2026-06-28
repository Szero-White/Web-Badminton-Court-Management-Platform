import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingApi, staffApi } from '../services/api';
import './StaffPage.css';

function todayString() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDateLabel(dateStr) {
  const date = new Date(dateStr);
  const today = new Date(todayString());
  const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Ngày mai';
  if (diffDays === 2) return 'Ngày kia';

  return date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric'
  });
}

function formatDateFull(dateStr) {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function compareSlotTime(a, b) {
  const diff = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  if (diff !== 0) return diff;
  return Number(a.court_id || 0) - Number(b.court_id || 0);
}

function compareCourtThenTime(a, b) {
  const courtDiff = Number(a.court_id || 0) - Number(b.court_id || 0);
  if (courtDiff !== 0) return courtDiff;
  return compareSlotTime(a, b);
}

function slotMinuteOfDay(value) {
  const dt = new Date(value);
  return (dt.getHours() * 60) + dt.getMinutes();
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('vi-VN');
}

function paymentMethodLabel(value) {
  return value === 'transfer' ? 'chuyển khoản' : 'tiền mặt';
}

function buildDepositNote(existingNote, amount, method, reference) {
  const base = (existingNote || '').trim();
  const parts = [`Cọc: ${formatMoney(amount)} VND (${paymentMethodLabel(method)})`];
  if (reference?.trim()) {
    parts.push(`Mã GD: ${reference.trim()}`);
  }
  const segment = parts.join(' | ');
  if (!base) return segment;
  return `${base} | ${segment}`;
}

function timeKey(value) {
  const dt = new Date(value);
  const hours = `${dt.getHours()}`.padStart(2, '0');
  const minutes = `${dt.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function makeBookingGroupKey(slot) {
  if (!slot || !slot.start_time) return '';
  // Group by court + customer only, ignore booking_code to group consecutive slots
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
      const timeGap = thisStartTime - lastEndTime;
      
      // If gap is small (less than 1 hour), it's the same continuous booking
      if (timeGap <= 60 * 60 * 1000) {
        currentGroup.slots.push(slot);
        currentGroup.booking_ids.push(slot.booking_id);
        currentGroup.time_slot_ids.push(slot.id);
        currentGroup.slot_count += 1;
        currentGroup.total_price += Number(slot.price || 0);
        currentGroup.deposit_paid += Number(slot.deposit_paid || 0);
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
      court_names: [slot.court_name || `Sân ${slot.court_id}`],
      customer_name: slot.customer_name,
      customer_phone: slot.customer_phone,
      customer_type: slot.customer_type,
      booking_code: slot.booking_code,
      booking_note: slot.booking_note,
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: slot.status,
      total_price: Number(slot.price || 0),
      deposit_paid: Number(slot.deposit_paid || 0),
      remaining_due: Number(slot.remaining_due || slot.price || 0),
      slot_count: 1,
      slots: [slot],
      booking_ids: [slot.booking_id],
      time_slot_ids: [slot.id]
    };
    grouped.set(groupKey + '_' + slot.start_time, newGroup); // Unique key with timestamp
    currentGroup = newGroup;
    currentGroupKey = groupKey;
  });

  return [...grouped.values()].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

function buildHeatmapGrid(slots, courts) {
  const timeBands = [];
  const startKeys = new Set();

  slots.forEach((slot) => {
    const startKey = timeKey(slot.start_time);
    if (startKeys.has(startKey)) {
      return;
    }
    startKeys.add(startKey);
    timeBands.push({
      startKey,
      label: `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`
    });
  });

  timeBands.sort((a, b) => a.startKey.localeCompare(b.startKey));

  const slotMap = new Map();
  slots.forEach((slot) => {
    slotMap.set(`${slot.court_id}|${timeKey(slot.start_time)}`, slot);
  });

  return timeBands.map(({ startKey, label }) => ({
    time: startKey,
    label,
    cells: courts.map((court) => slotMap.get(`${court.courtId}|${startKey}`) || null)
  }));
}

function getDepositPreviewByAmount(amount) {
  const paid = Number(amount || 0);
  if (Number.isFinite(paid) && paid > 0) {
    return `Cọc: ${formatMoney(paid)} VND`;
  }
  return '';
}

export default function StaffPage() {
  const [message, setMessage] = useState('Nhân viên chỉ xử lý vận hành booking, không có quyền cấu hình sân.');
  const [loading, setLoading] = useState(false);
  const [checkInCode, setCheckInCode] = useState('');
  const [lastCheckin, setLastCheckin] = useState(null);
  const [checkinFeed, setCheckinFeed] = useState([]);
  const [selectedBookingKey, setSelectedBookingKey] = useState(null);
  const [depositEdit, setDepositEdit] = useState({ amount: '', method: 'transfer', reference: '' });
  
  // Booking edit form (like Admin)
  const [bookingEditForm, setBookingEditForm] = useState({
    customerName: '',
    customerPhone: '',
    customerType: 'walk_in',
    notes: '',
    deposit: 0
  });
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  
  const [bookingForm, setBookingForm] = useState({
    day: todayString(),
    startTimeSlotId: '',
    endTimeSlotId: '',
    customerPhone: '',
    customerName: '',
    customerType: 'walk_in',
    notes: '',
    collectDeposit: false,
    depositAmount: '',
    depositMethod: 'transfer',
    depositReference: ''
  });
  const [daySlots, setDaySlots] = useState([]);
  const [viewDay, setViewDay] = useState(todayString());

  const sortedSlots = useMemo(
    () => [...(daySlots || [])].sort(compareSlotTime),
    [daySlots]
  );

  const groupedSlotsByCourt = useMemo(() => {
    const grouped = new Map();
    sortedSlots.forEach((slot) => {
      const key = `${slot.court_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(slot);
    });

    return [...grouped.entries()].map(([courtId, slots]) => {
      const byMinute = new Map();
      slots.forEach((slot) => {
        byMinute.set(slotMinuteOfDay(slot.start_time), slot);
      });

      const orderedSlots = [];
      for (let minute = 0; minute < 24 * 60; minute += 30) {
        const slot = byMinute.get(minute);
        if (slot) {
          orderedSlots.push(slot);
        }
      }

      return {
        courtId,
        courtName: slots[0]?.court_name || `Sân ${courtId}`,
        slots: orderedSlots
      };
    }).sort((a, b) => Number(a.courtId) - Number(b.courtId));
  }, [sortedSlots]);

  const courtColumns = useMemo(
    () => groupedSlotsByCourt.map((group) => ({ courtId: group.courtId, courtName: group.courtName })),
    [groupedSlotsByCourt]
  );

  const heatmapGrid = useMemo(
    () => buildHeatmapGrid(sortedSlots, courtColumns),
    [sortedSlots, courtColumns]
  );

  const bookingGroups = useMemo(
    () => groupBookedSlots(sortedSlots.filter((slot) => slot.booked)),
    [sortedSlots]
  );

  const selectedBooking = useMemo(
    () => bookingGroups.find((group) => group.groupKey === selectedBookingKey) || bookingGroups[0] || null,
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

  const selectedStartSlot = useMemo(
    () => sortedSlots.find((slot) => String(slot.id) === String(bookingForm.startTimeSlotId)),
    [sortedSlots, bookingForm.startTimeSlotId]
  );

  const endSlots = useMemo(() => {
    if (!selectedStartSlot) {
      return [];
    }

    return sortedSlots.filter((slot) => {
      if (Number(slot.court_id) !== Number(selectedStartSlot.court_id)) {
        return false;
      }
      return new Date(slot.start_time).getTime() > new Date(selectedStartSlot.start_time).getTime() && !slot.booked;
    });
  }, [sortedSlots, selectedStartSlot]);

  function handleDeskCellClick(slot) {
    if (!slot) {
      return;
    }

    if (slot.booked) {
      setSelectedBookingKey(makeBookingGroupKey(slot));
      return;
    }

    setBookingForm((prev) => ({
      ...prev,
      startTimeSlotId: String(slot.id),
      endTimeSlotId: ''
    }));
    setMessage(`Đã chọn slot trống ${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}.`);
  }

  async function loadSlots(day) {
    try {
      const res = await bookingApi.getDaySlots(day);
      const nextSlots = res.data?.data || [];
      setDaySlots(nextSlots);
      const groups = groupBookedSlots(nextSlots.filter((slot) => slot.booked));
      setSelectedBookingKey((prev) => (prev && groups.some((group) => group.groupKey === prev) ? prev : groups[0]?.groupKey || null));
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không tải được lịch trong ngày.');
    }
  }

  async function confirmSelectedDeposit(item) {
    const targetDeposit = Math.round(Number(depositEdit.amount || 0));
    if (!Number.isFinite(targetDeposit) || targetDeposit < 0) {
      setMessage('Vui lòng nhập số tiền cọc hợp lệ.');
      return;
    }

    const maxDeposit = item.slots.reduce((sum, slot) => sum + Math.round(Number(slot.price || 0)), 0);
    if (targetDeposit > maxDeposit) {
      setMessage(`Tổng cọc không được vượt quá tổng tiền booking ${formatMoney(maxDeposit)} VND.`);
      return;
    }

    setLoading(true);
    try {
      let remaining = targetDeposit;
      for (let index = 0; index < item.booking_ids.length; index += 1) {
        const bookingId = item.booking_ids[index];
        const slotPrice = Math.round(Number(item.slots[index]?.price || 0));
        const depositForBooking = Math.min(remaining, Math.max(0, slotPrice));

        await staffApi.updateBooking(bookingId, {
          deposit_total: depositForBooking
        });

        remaining -= depositForBooking;
      }

      setDepositEdit({ amount: '', method: 'transfer', reference: '' });
      setMessage(`Đã cập nhật tổng cọc mới: ${formatMoney(targetDeposit)} VND cho booking ${item.booking_code}.`);
      await loadSlots(viewDay);
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không cập nhật được cọc booking.');
    } finally {
      setLoading(false);
    }
  }

  async function doCheckin(e) {
    e.preventDefault();
    try {
      const res = await staffApi.checkin(checkInCode);
      const booking = res.data?.data;
      setLastCheckin(booking || null);
      if (booking) {
        setCheckinFeed((prev) => [booking, ...prev.filter((item) => item.id !== booking.id)].slice(0, 6));
      }
      setCheckInCode('');
      setMessage(`Đã tìm thấy booking ${booking?.booking_code || ''} (trạng thái: ${booking?.status || '-'})`);
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Check-in thất bại.');
    }
  }

  async function createBookingForCustomer(e) {
    e.preventDefault();
    if (!bookingForm.startTimeSlotId || !bookingForm.endTimeSlotId || !bookingForm.customerPhone || !bookingForm.customerName.trim()) {
      setMessage('Vui lòng chọn giờ bắt đầu, giờ kết thúc, nhập SĐT và tên khách.');
      return;
    }

    if (String(bookingForm.startTimeSlotId) === String(bookingForm.endTimeSlotId)) {
      setMessage('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
      return;
    }

    const depositEnabled = Boolean(bookingForm.collectDeposit);
    const depositAmount = Math.round(Number(bookingForm.depositAmount || 0));
    if (depositEnabled && (!Number.isFinite(depositAmount) || depositAmount <= 0)) {
      setMessage('Nếu chọn cọc trước, vui lòng nhập số tiền cọc hợp lệ.');
      return;
    }

    const composedNote = depositEnabled
      ? buildDepositNote(bookingForm.notes, depositAmount, bookingForm.depositMethod, bookingForm.depositReference)
      : bookingForm.notes.trim();

    try {
      const res = await bookingApi.createForCustomer({
        start_time_slot_id: Number(bookingForm.startTimeSlotId),
        end_time_slot_id: Number(bookingForm.endTimeSlotId),
        customer_phone: bookingForm.customerPhone,
        customer_name: bookingForm.customerName.trim(),
        customer_type: bookingForm.customerType,
        notes: composedNote
      });
      const payload = res.data?.data;
      const bookings = payload?.bookings || (payload ? [payload] : []);
      const bookingCode = bookings[0]?.booking_code || 'booking';

      let deposited = 0;
      if (depositEnabled && bookings.length > 0) {
        let remaining = depositAmount;
        for (const booking of bookings) {
          if (!booking?.id || remaining <= 0) {
            continue;
          }

          const cap = Number(booking.remaining_due ?? booking.total_price ?? 0);
          const amountToPay = Math.min(remaining, cap > 0 ? cap : remaining);
          if (amountToPay <= 0) {
            continue;
          }

          await bookingApi.confirmDeposit(booking.id, {
            amount: amountToPay,
            method: bookingForm.depositMethod,
            reference: bookingForm.depositReference?.trim() || ''
          });

          deposited += amountToPay;
          remaining -= amountToPay;
        }
      }

      const startLabel = selectedStartSlot ? formatTime(selectedStartSlot.start_time) : '';
      const endLabel = endSlots.find((slot) => String(slot.id) === String(bookingForm.endTimeSlotId))
        ? formatTime(endSlots.find((slot) => String(slot.id) === String(bookingForm.endTimeSlotId)).start_time)
        : '';
      const depositMsg = deposited > 0
        ? ` Đã ghi nhận cọc ${formatMoney(deposited)} VND (${paymentMethodLabel(bookingForm.depositMethod)}).`
        : '';
      setMessage(
        bookings.length > 1
          ? `Đã tạo ${bookings.length} slot booking cho khách ${bookingForm.customerPhone} (${startLabel} - ${endLabel}). Mã đầu tiên: ${bookingCode}.${depositMsg}`
          : `Đã tạo booking ${bookingCode} cho khách ${bookingForm.customerPhone}.${depositMsg}`
      );
      localStorage.setItem('last_booking_day', bookingForm.day);
      setBookingForm((prev) => ({
        ...prev,
        startTimeSlotId: '',
        endTimeSlotId: '',
        customerPhone: '',
        customerName: '',
        customerType: 'walk_in',
        notes: '',
        collectDeposit: false,
        depositAmount: '',
        depositMethod: 'transfer',
        depositReference: ''
      }));
      await loadSlots(viewDay);
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không tạo được booking cho khách.');
    }
  }

  useEffect(() => {
    loadSlots(viewDay);
  }, [viewDay]);

  return (
    <section className="panel staff-page">
      <div className="staff-hero">
        <div>
          <h2>Nhân viên</h2>
        </div>
        <div className="staff-quick-links">
          <Link to="/staff/beverage-counter" className="staff-link-pill">Bán và nhập nước</Link>
          <Link to="/staff/transactions" className="staff-link-pill">Sổ thu chi ca</Link>
        </div>
      </div>

      <p className="message staff-message">{message}</p>

      <article className="staff-action-card staff-booking-board">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Bảng sân theo giờ</h3>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>Bấm ô đã đặt để chọn booking, bấm ô trống để chọn giờ bắt đầu.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>Xem ngày:</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                const day = addDays(todayString(), offset);
                const isActive = viewDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => setViewDay(day)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: 'none',
                      background: isActive ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f5f5f5',
                      color: isActive ? 'white' : '#555',
                      fontSize: '13px',
                      fontWeight: isActive ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {formatDateLabel(day)}
                  </button>
                );
              })}
            </div>
            <input
              type="date"
              value={viewDay}
              onChange={(e) => setViewDay(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: '2px solid #e0e0e0',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '12px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📅</span>
            <span style={{ fontSize: '18px', fontWeight: '600' }}>{formatDateFull(viewDay)}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewDay(addDays(viewDay, -1))}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              ← Hôm qua
            </button>
            <button
              onClick={() => setViewDay(addDays(viewDay, 1))}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Ngày mai →
            </button>
          </div>
        </div>

        <div className="heatmap-wrapper staff-heatmap-wrap">
          <table className="heatmap staff-heatmap-table">
            <thead>
              <tr>
                <th className="time-header">Giờ</th>
                {courtColumns.map((court) => (
                  <th key={court.courtId} className="court-header">
                    <div className="court-header-content">
                      <strong>{court.courtName}</strong>
                      <small>Sân {court.courtId}</small>
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
                    if (!slot) {
                      return <td key={`${time}-${idx}`} className="heatmap-cell empty">-</td>;
                    }

                    const isSelected = selectedBookingSlotIds.has(String(slot.id));
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
                          onClick={() => handleDeskCellClick(slot)}
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
                        <button className="cell-button" onClick={() => handleDeskCellClick(slot)}>
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
        </div>
      </article>

      <div className="staff-action-grid">
        <article className="staff-action-card staff-action-card--wide">
          <h3>Đặt sân cho khách</h3>
          <p>Chọn ngày, khung giờ trống, nhập SĐT và tạo booking nhanh tại quầy.</p>
          <form className="staff-form staff-form--grid" onSubmit={createBookingForCustomer}>
            <input
              className="staff-form-full"
              type="date"
              value={bookingForm.day}
              onChange={(e) => {
                const nextDay = e.target.value;
                setBookingForm((prev) => ({ ...prev, day: nextDay, startTimeSlotId: '', endTimeSlotId: '' }));
                loadSlots(nextDay);
              }}
            />
            <select value={bookingForm.startTimeSlotId} onChange={(e) => setBookingForm((prev) => ({ ...prev, startTimeSlotId: e.target.value, endTimeSlotId: '' }))}>
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
            <select
              value={bookingForm.endTimeSlotId}
              onChange={(e) => setBookingForm((prev) => ({ ...prev, endTimeSlotId: e.target.value }))}
              disabled={!selectedStartSlot}
            >
              <option value="">Chọn giờ kết thúc</option>
              {endSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.court_name} | {formatTime(slot.start_time)}
                </option>
              ))}
            </select>
            <input
              placeholder="Số điện thoại khách"
              value={bookingForm.customerPhone}
              onChange={(e) => setBookingForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
            />
            <input
              placeholder="Tên khách"
              value={bookingForm.customerName}
              onChange={(e) => setBookingForm((prev) => ({ ...prev, customerName: e.target.value }))}
              required
            />
            <select
              value={bookingForm.customerType}
              onChange={(e) => setBookingForm((prev) => ({ ...prev, customerType: e.target.value }))}
            >
              <option value="walk_in">Khách vãng lai</option>
              <option value="monthly">Khách cố định theo tháng</option>
            </select>
            <textarea
              className="staff-form-full"
              placeholder="Ghi chú thêm (ví dụ: khách chơi tới 11:10, thêm giờ lẻ...)"
              value={bookingForm.notes}
              onChange={(e) => setBookingForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows="2"
            />
            <label className="staff-form-full staff-deposit-toggle">
              <input
                type="checkbox"
                checked={bookingForm.collectDeposit}
                onChange={(e) => setBookingForm((prev) => ({ ...prev, collectDeposit: e.target.checked }))}
              />
              <span>Khách cọc trước</span>
            </label>
            {bookingForm.collectDeposit ? (
              <div className="staff-form-full staff-deposit-grid">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Số tiền cọc"
                  value={bookingForm.depositAmount}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, depositAmount: e.target.value }))}
                />
                <select
                  value={bookingForm.depositMethod}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, depositMethod: e.target.value }))}
                >
                  <option value="transfer">Chuyển khoản</option>
                  <option value="cash">Tiền mặt</option>
                </select>
                <input
                  placeholder="Mã giao dịch / ghi chú cọc"
                  value={bookingForm.depositReference}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, depositReference: e.target.value }))}
                />
              </div>
            ) : null}
            <button className="staff-form-full" type="submit">Tạo booking cho khách</button>
            {selectedStartSlot ? (
              <p className="staff-form-full" style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.8 }}>
                Đang chọn: {selectedStartSlot.court_name} | {formatTime(selectedStartSlot.start_time)} trở đi. Giờ kết thúc là mốc trả sân (theo từng khung 30 phút).
              </p>
            ) : null}
          </form>
        </article>

        <article className="staff-action-card staff-action-card--wide">
          <h3>Check-in khách</h3>
          <p>Nhập mã booking hoặc số điện thoại để check-in nhanh.</p>
          <form className="staff-form" onSubmit={doCheckin}>
            <input placeholder="Mã booking hoặc SĐT" value={checkInCode} onChange={(e) => setCheckInCode(e.target.value)} />
            <button type="submit">Check-in</button>
          </form>

          {lastCheckin ? (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid rgba(18,35,34,0.14)', borderRadius: 12, background: 'rgba(29,116,113,0.06)' }}>
              <strong>Thông tin check-in vừa xử lý</strong>
              <p style={{ margin: '8px 0 4px' }}><strong>Khách:</strong> {lastCheckin.user?.full_name || '-'}</p>
              <p style={{ margin: '4px 0' }}><strong>SĐT:</strong> {lastCheckin.user?.phone || '-'}</p>
              <p style={{ margin: '4px 0' }}><strong>Sân:</strong> {lastCheckin.court?.name || '-'}</p>
              <p style={{ margin: '4px 0' }}><strong>Khung giờ:</strong> {formatDateTime(lastCheckin.time_slot?.start_time)} - {formatTime(lastCheckin.time_slot?.end_time)}</p>
              <p style={{ margin: '4px 0' }}><strong>Loại khách:</strong> {lastCheckin.customer_type === 'monthly' ? 'Khách tháng' : 'Khách vãng lai'}</p>
              <p style={{ margin: '4px 0' }}><strong>Trạng thái:</strong> {lastCheckin.status}</p>
              <p style={{ margin: '4px 0' }}><strong>Mã booking:</strong> {lastCheckin.booking_code}</p>
              <p style={{ margin: '4px 0' }}><strong>Tổng tiền:</strong> {Number(lastCheckin.total_price || 0).toLocaleString('vi-VN')} VND</p>
              {lastCheckin.notes ? <p style={{ margin: '4px 0' }}><strong>Ghi chú:</strong> {lastCheckin.notes}</p> : null}
            </div>
          ) : null}

          {checkinFeed.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <strong>Danh sách check-in gần đây</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {checkinFeed.map((item) => (
                  <div key={item.id} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(18,35,34,0.12)', background: '#fff' }}>
                    <div style={{ fontWeight: 700 }}>{item.user?.full_name || 'Khách'} - {item.user?.phone || '-'}</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>{item.court?.name || '-'} | {formatDateTime(item.time_slot?.start_time)} - {formatTime(item.time_slot?.end_time)}</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>Mã: {item.booking_code} | Trạng thái: {item.status}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="staff-action-card staff-action-card--wide">
          <h3>Sửa cọc booking đang chọn</h3>
          <p>Nhập tổng cọc mới, hệ thống sẽ ghi đè số cũ cho toàn bộ slot trong booking đã chọn.</p>

          <label className="staff-booking-select">
            <span>Chọn booking</span>
            <select
              value={selectedBooking?.groupKey || ''}
              onChange={(e) => setSelectedBookingKey(e.target.value)}
              disabled={bookingGroups.length === 0}
            >
              {bookingGroups.length === 0 ? <option value="">Không có booking</option> : null}
              {bookingGroups.map((group) => (
                <option key={group.groupKey} value={group.groupKey}>
                  {group.booking_code || 'Booking'} | {group.court_names?.join(', ') || group.court_name} | {formatTime(group.start_time)} - {formatTime(group.end_time)} ({group.slot_count} slot)
                </option>
              ))}
            </select>
          </label>

          {selectedBooking ? (
            <div className="staff-deposit-editor">
              <div style={{ marginBottom: '12px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>📋 Thông tin booking</p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>Mã: {selectedBooking.booking_code}</p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>Sân: {selectedBooking.court_names?.join(', ') || selectedBooking.court_name}</p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>Khách: {selectedBooking.customer_name} ({selectedBooking.customer_phone})</p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>Thời gian: {formatTime(selectedBooking.start_time)} - {formatTime(selectedBooking.end_time)}</p>
                {selectedBooking.booking_note && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                    📝 Ghi chú: {selectedBooking.booking_note}
                  </p>
                )}
              </div>

              <p className="staff-deposit-current">Đã cọc hiện tại: {formatMoney(selectedBooking.deposit_paid || 0)} VND</p>
              <div className="staff-deposit-grid">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Nhập tổng cọc mới"
                  value={depositEdit.amount}
                  onChange={(e) => setDepositEdit((prev) => ({ ...prev, amount: e.target.value }))}
                />
                <select
                  value={depositEdit.method}
                  onChange={(e) => setDepositEdit((prev) => ({ ...prev, method: e.target.value }))}
                >
                  <option value="transfer">Chuyển khoản</option>
                  <option value="cash">Tiền mặt</option>
                </select>
                <input
                  placeholder="Mã giao dịch / ghi chú"
                  value={depositEdit.reference}
                  onChange={(e) => setDepositEdit((prev) => ({ ...prev, reference: e.target.value }))}
                />
              </div>
              <p className="staff-deposit-current">Tổng cọc sau cập nhật: {formatMoney(Math.max(0, Math.round(Number(depositEdit.amount || 0))))} VND</p>
              <button type="button" onClick={() => confirmSelectedDeposit(selectedBooking)} disabled={loading}>
                {loading ? 'Đang cập nhật...' : 'Cập nhật cọc'}
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, opacity: 0.75 }}>Ngày này chưa có booking để chỉnh cọc.</p>
          )}
        </article>

      </div>

      <div className="staff-footer-actions">
        <Link to="/staff/beverage-counter" className="staff-link-secondary">Mở bảng bán/nhập nước</Link>
        <Link to="/staff/transactions" className="staff-link-secondary">Mở sổ thu chi ca</Link>
      </div>
    </section>
  );
}
