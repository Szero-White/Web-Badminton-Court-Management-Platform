import { useEffect, useMemo, useState } from 'react';
import { beverageApi, bookingApi } from '../services/api';
import CustomerBookingsPanel from '../features/customer/CustomerBookingsPanel';
import MultiSelectDropdown from '../components/filters/MultiSelectDropdown';
import ScheduleDateNavigator from '../components/schedule/ScheduleDateNavigator';
import { todayString } from '../utils/dateTime';
import './CustomerPage.css';

export default function CustomerPage() {
  const [day, setDay] = useState(todayString());
  const [daySlots, setDaySlots] = useState([]);
  const [courtCatalog, setCourtCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Chọn ngày để xem bảng lịch đặt sân.');
  const [selectedCourtIds, setSelectedCourtIds] = useState([]);
  const [beverages, setBeverages] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const isCustomer = localStorage.getItem('user_role') === 'customer' && Boolean(localStorage.getItem('access_token'));

  function timeKey(value) {
    const dt = new Date(value);
    const hh = `${dt.getHours()}`.padStart(2, '0');
    const mm = `${dt.getMinutes()}`.padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function formatTime(value) {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  const fallbackBeverages = [
    { name: 'Nước suối', price: 10000, note: 'Nước uống đóng chai' },
    { name: 'Nước điện giải', price: 20000, note: 'Bổ sung điện giải sau khi chơi' },
    { name: 'Khăn lạnh', price: 5000, note: 'Khăn lạnh dùng tại sân' }
  ];

  const courts = useMemo(() => {
    return [...courtCatalog].sort((a, b) => a.id - b.id);
  }, [courtCatalog]);

  useEffect(() => {
    setSelectedCourtIds((previous) => previous.filter((courtId) => courts.some((court) => String(court.id) === String(courtId))));
  }, [courts]);

  const courtFilterOptions = useMemo(() => {
    return courts.map((court) => ({
      value: String(court.id),
      label: court.name,
      description: court.court_type || 'Sân tiêu chuẩn'
    }));
  }, [courts]);

  const filteredCourts = useMemo(() => {
    if (selectedCourtIds.length === 0) {
      return courts;
    }

    const selected = new Set(selectedCourtIds.map(String));
    return courts.filter((court) => selected.has(String(court.id)));
  }, [courts, selectedCourtIds]);

  const courtSummary = useMemo(() => {
    if (selectedCourtIds.length === 0) {
      return 'Tất cả sân';
    }

    if (selectedCourtIds.length === 1) {
      const selectedCourt = courts.find((court) => String(court.id) === String(selectedCourtIds[0]));
      return selectedCourt?.name || '1 sân đã chọn';
    }

    return `${selectedCourtIds.length} sân đã chọn`;
  }, [courts, selectedCourtIds]);

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

  const heatmapGrid = useMemo(() => {
    return timeBands.map(({ startKey, label }) => ({
      time: startKey,
      label,
      cells: filteredCourts.map(
        (court) =>
          daySlots.find(
            (slot) => String(slot.court_id) === String(court.id) && timeKey(slot.start_time) === startKey
          ) || null
      )
    }));
  }, [daySlots, filteredCourts, timeBands]);

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

  async function loadBookings() {
    if (!isCustomer) {
      setBookings([]);
      return;
    }
    setBookingsLoading(true);
    try {
      const res = await bookingApi.myBookings();
      setBookings(res.data?.data || []);
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể tải booking của bạn.');
    } finally {
      setBookingsLoading(false);
    }
  }

  async function cancelBooking(bookingId, reason) {
    try {
      const res = await bookingApi.cancel(bookingId, reason);
      const refund = Number(res.data?.data?.refund_amount || 0);
      setMessage(refund > 0 ? `Đã hủy booking. Giá trị hoàn: ${refund.toLocaleString('vi-VN')} VND.` : 'Đã hủy booking.');
      await Promise.all([loadBookings(), loadSlots()]);
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể hủy booking.');
    }
  }

  async function reserve(slotId) {
    if (!localStorage.getItem('access_token') || localStorage.getItem('user_role') !== 'customer') {
      setMessage('Bạn cần đăng nhập bằng tài khoản khách hàng trước khi đặt sân.');
      return;
    }
    try {
      const res = await bookingApi.createPending(slotId);
      const booking = res.data?.data;
      setMessage(`Giữ chỗ thành công: ${booking.booking_code}. Vui lòng liên hệ quầy để xác nhận cọc trước khi hết thời gian giữ.`);
      await Promise.all([loadSlots(), loadBookings()]);
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể giữ chỗ.');
    }
  }

  useEffect(() => {
    loadCourts();
    loadBeverages();
    loadBookings();
  }, []);

  useEffect(() => {
    loadSlots();
  }, [day]);

  return (
    <section className="panel customer customer-soft-layout">
      <div className="panel-header customer-header">
        <div className="customer-heading">
          <span className="customer-eyebrow">Lịch theo ngày</span>
          <h2>Bảng đặt sân & đồ uống</h2>
          <p>Chọn ngày, lọc theo nhiều sân và nhấn trực tiếp vào ô trống để giữ chỗ nhanh.</p>
        </div>

        <div className="filters filters-wrap customer-toolbar">
          <MultiSelectDropdown
            label="Lọc theo sân"
            allLabel="Tất cả sân"
            triggerLabel={courtSummary}
            options={courtFilterOptions}
            selectedValues={selectedCourtIds}
            onChange={setSelectedCourtIds}
          />
        </div>
      </div>

      <ScheduleDateNavigator value={day} onChange={setDay} />

      <div className="customer-status-stack">
        <p className="message soft-message">{message}</p>
        {!isCustomer ? (
          <p className="message soft-message soft-message-muted">
            Vui lòng đăng nhập bằng tài khoản khách hàng để đặt sân trực tiếp trên bảng lịch.
          </p>
        ) : null}
      </div>

      <div className="legend soft-legend">
        <span><i className="legend-free" /> Còn trống - đặt được</span>
        <span><i className="legend-booked" /> Đã đặt - có người</span>
        <span><i className="legend-drink" /> Khu bán nước</span>
      </div>

      <div className="customer-inline-summary">
        <span>{courtSummary}</span>
        <span>{filteredCourts.length} sân hiển thị</span>
        <span>{timeBands.length} khung giờ</span>
      </div>

      <div className="heatmap-wrapper soft-heatmap-wrapper">
        <table className="heatmap">
          <thead>
            <tr>
              <th className="time-header">Giờ</th>
              {filteredCourts.map((court) => (
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
                    return (
                      <td key={slot.id} className="heatmap-cell booked" title="Khung giờ đã được đặt">
                        <div className="cell-content">
                          <span className="booking-code">Đã đặt</span>
                          <span className="booking-time">Không còn trống</span>
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={slot.id} className="heatmap-cell free">
                      <button
                        className="cell-button"
                        onClick={() => reserve(slot.id)}
                        title={`${slot.price?.toLocaleString('vi-VN')} VND\nClick để đặt`}
                      >
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

        {filteredCourts.length === 0 ? (
          <p className="message soft-message">Chưa có sân nào được chọn để hiển thị. Vui lòng chọn ít nhất một sân.</p>
        ) : null}

        {filteredCourts.length > 0 && timeBands.length === 0 ? (
          <p className="message soft-message">
            Đã có sân mới nhưng ngày này chưa sinh slot, nên chưa có ô giờ để bấm đặt.
          </p>
        ) : null}
      </div>

      {isCustomer ? (
        <CustomerBookingsPanel
          bookings={bookings}
          loading={bookingsLoading}
          onCancel={cancelBooking}
          onRefresh={loadBookings}
        />
      ) : null}

      <div className="drink-board soft-drink-board">
        <div className="drink-board-header">
          <div>
            <h3>Quầy nước nhanh</h3>
            <p>Gợi ý bán kèm cho khách chờ sân.</p>
          </div>
          <span className="drink-chip">Phục vụ nhanh</span>
        </div>
        <div className="drink-grid">
          {(beverages.length ? beverages : fallbackBeverages).map((drink) => (
            <article className="drink-card" key={drink.name}>
              <h4>{drink.name}</h4>
              <strong>{Number(drink.price).toLocaleString('vi-VN')} VND</strong>
              <p>{drink.description || drink.note}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
