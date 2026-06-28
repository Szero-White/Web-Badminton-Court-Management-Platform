import { useEffect, useMemo, useState } from 'react';
import { beverageApi, bookingApi } from '../services/api';

function todayString() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function compareSlotTime(a, b) {
  const diff = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  if (diff !== 0) return diff;
  return Number(a.court_id || 0) - Number(b.court_id || 0);
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
    if (currentGroup && currentGroupKey === groupKey && currentGroup.slots.length > 0) {
      const lastSlot = currentGroup.slots[currentGroup.slots.length - 1];
      const lastEndTime = new Date(lastSlot.end_time).getTime();
      const thisStartTime = new Date(slot.start_time).getTime();
      const timeGap = thisStartTime - lastEndTime;
      
      // If gap is small (less than 1 hour), it's the same continuous booking
      if (timeGap <= 60 * 60 * 1000) {
        currentGroup.slots.push(slot);
        currentGroup.deposit_paid += Number(slot.deposit_paid || 0);
        // Update end_time to the latest slot's end_time
        if (new Date(slot.end_time) > new Date(currentGroup.end_time)) {
          currentGroup.end_time = slot.end_time;
        }
        // Use the first booking_code and note
        if (!currentGroup.booking_code) currentGroup.booking_code = slot.booking_code;
        if (!currentGroup.booking_note) currentGroup.booking_note = slot.booking_note;
        return;
      }
    }

    // Start a new group
    const newGroup = {
      groupKey,
      booking_code: slot.booking_code,
      customer_name: slot.customer_name,
      customer_phone: slot.customer_phone,
      customer_type: slot.customer_type,
      booking_note: slot.booking_note,
      deposit_paid: Number(slot.deposit_paid || 0),
      start_time: slot.start_time,
      end_time: slot.end_time,
      slots: [slot]
    };
    grouped.set(groupKey + '_' + slot.start_time, newGroup);
    currentGroup = newGroup;
    currentGroupKey = groupKey;
  });

  return [...grouped.values()];
}

export default function CustomerPage() {
  const [day, setDay] = useState(todayString());
  const [daySlots, setDaySlots] = useState([]);
  const [courtCatalog, setCourtCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Chọn ngày để xem bảng lịch đặt sân.');
  const [selectedCourt, setSelectedCourt] = useState('all');
  const [beverages, setBeverages] = useState([]);

  function timeKey(value) {
    const dt = new Date(value);
    const hh = `${dt.getHours()}`.padStart(2, '0');
    const mm = `${dt.getMinutes()}`.padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const drinks = [
    { name: 'Nước suối', price: '10.000', note: 'Giải khát nhanh' },
    { name: 'Trà chanh', price: '20.000', note: 'Mát lạnh sau trận đấu' },
    { name: 'Nước điện giải', price: '25.000', note: 'Bù khoáng, hồi phục' },
    { name: 'Cà phê đá', price: '22.000', note: 'Nạp tỉnh táo trước giờ chơi' }
  ];

  const courts = useMemo(() => {
    return [...courtCatalog].sort((a, b) => a.id - b.id);
  }, [courtCatalog]);

  const timeBands = useMemo(() => {
    const bandsByStart = new Map();

    daySlots.forEach((slot) => {
      const startKey = timeKey(slot.start_time);
      if (!bandsByStart.has(startKey)) {
        bandsByStart.set(startKey, {
          startKey,
          label: `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`
        });
      }
    });

    return [...bandsByStart.values()].sort((a, b) => a.startKey.localeCompare(b.startKey));
  }, [daySlots]);

  // Heatmap grid: rows = timeBands, cols = courts
  const heatmapGrid = useMemo(() => {
    const courtList = selectedCourt === 'all' ? courts : courts.filter((court) => String(court.id) === selectedCourt);
    return timeBands.map(({ startKey, label }) => ({
      time: startKey,
      label,
      cells: courtList.map((court) => 
        daySlots.find((slot) => 
          String(slot.court_id) === String(court.id) && 
          timeKey(slot.start_time) === startKey
        ) || null
      )
    }));
  }, [daySlots, courts, selectedCourt, timeBands]);

  // Group bookings and map deposit/note to all slots in the same booking
  const bookingGroups = useMemo(() => {
    return groupBookedSlots(daySlots.filter((slot) => slot.booked));
  }, [daySlots]);

  const groupInfoBySlotId = useMemo(() => {
    const map = new Map();
    bookingGroups.forEach((group) => {
      const slotCount = group.slots.length;
      const hasNote = !!group.booking_note;
      group.slots.forEach((slot) => {
        map.set(String(slot.id), {
          deposit: group.deposit_paid,
          note: group.booking_note,
          slotCount,
          hasNote,
          groupKey: group.groupKey
        });
      });
    });
    return map;
  }, [bookingGroups]);

  async function loadSlots() {
    setLoading(true);
    setMessage('Đang tải bảng lịch...');
    try {
      const res = await bookingApi.getDaySlots(day);
      const data = res.data?.data || [];
      setDaySlots(data);
      setMessage(data.length ? 'Đã tải bảng lịch.' : 'Chưa có slot nào cho ngày này.');
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể tải slot.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCourts() {
    try {
      const res = await bookingApi.listCourts();
      setCourtCatalog(res.data?.data || []);
    } catch {
      setCourtCatalog([]);
    }
  }

  async function loadBeverages() {
    try {
      const res = await beverageApi.list();
      setBeverages(res.data?.data || []);
    } catch {
      setBeverages([]);
    }
  }

  async function reserve(slotId) {
    if (!localStorage.getItem('access_token') || localStorage.getItem('user_role') !== 'customer') {
      setMessage('Bạn cần đăng nhập customer tại Portal Login trước khi đặt sân.');
      return;
    }
    try {
      const res = await bookingApi.createPending(slotId);
      const booking = res.data?.data;
      setMessage(`Giữ chỗ thành công: ${booking.booking_code}. Vui lòng thanh toán cọc trước khi hết thời gian giữ.`);
      loadSlots();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể giữ chỗ.');
    }
  }

  function formatTime(value) {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  useEffect(() => {
    loadCourts();
    loadSlots();
    loadBeverages();
  }, []);

  return (
    <section className="panel customer">
      <div className="panel-header">
        <div>
          <h2>Bảng đặt sân & đồ uống</h2>
          <p>Chọn ngày, nhìn theo khung giờ, nhấn trực tiếp vào ô trống để đặt sân.</p>
        </div>
        <div className="filters filters-wrap">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          <button onClick={loadSlots} disabled={loading}>{loading ? 'Loading...' : 'Xem Lịch'}</button>
          <select value={selectedCourt} onChange={(e) => setSelectedCourt(e.target.value)}>
            <option value="all">Tất cả sân</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>{court.name}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="message">{message}</p>
      <p className="message">Đặt sân cần đăng nhập customer tại Portal Login.</p>

      <div className="legend">
        <span><i className="legend-free" /> Còn trống - đặt được</span>
        <span><i className="legend-booked" /> Đã đặt - có người</span>
        <span><i className="legend-drink" /> Khu bán nước</span>
      </div>

      <div className="heatmap-wrapper">
        <table className="heatmap">
          <thead>
            <tr>
              <th className="time-header">Giờ</th>
              {(selectedCourt === 'all' ? courts : courts.filter((c) => String(c.id) === selectedCourt)).map((court) => (
                <th key={court.id} className="court-header">
                  <div className="court-header-content">
                    <strong>{court.name}</strong>
                    <small>{court.court_type}</small>
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

                  if (slot.booked) {
                    const customerTypeLabel = slot.customer_type === 'monthly' ? 'Khách tháng' : 'Khách vãng lai';
                    const groupInfo = groupInfoBySlotId.get(String(slot.id));
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
                        key={slot.id}
                        className={`heatmap-cell booked ${slot.customer_type === 'monthly' ? 'customer-monthly' : 'customer-walkin'}`}
                        onClick={() => reserve(slot.id)}
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
                    <td key={slot.id} className="heatmap-cell free">
                      <button className="cell-button" onClick={() => reserve(slot.id)} title={`${slot.price?.toLocaleString()} VND\nClick để đặt`}>
                        <span className="cell-price">{slot.price?.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</span>
                        <span className="cell-label">Đặt</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {courts.length > 0 && timeBands.length === 0 ? (
          <p className="message">Đã có sân mới nhưng ngày này chưa sinh slot, nên chưa có ô giờ để bấm đặt.</p>
        ) : null}
      </div>

      <div className="drink-board">
        <div className="drink-board-header">
          <div>
            <h3>Quầy nước nhanh</h3>
            <p>Gợi ý bán kèm cho khách chờ sân.</p>
          </div>
          <span className="drink-chip">Fast sale</span>
        </div>
        <div className="drink-grid">
          {(beverages.length ? beverages : drinks).map((drink) => (
            <article className="drink-card" key={drink.name}>
              <h4>{drink.name}</h4>
              <strong>{Number(drink.price).toLocaleString()} VND</strong>
              <p>{drink.description || drink.note}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
