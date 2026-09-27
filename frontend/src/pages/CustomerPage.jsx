import { useEffect, useMemo, useState } from 'react';
import { beverageApi, bookingApi } from '../services/api';
import AppToast from '../components/feedback/AppToast';
import ScheduleCourtFilterBar from '../components/schedule/ScheduleCourtFilterBar';
import ScheduleDateNavigator from '../components/schedule/ScheduleDateNavigator';
import ScheduleSlotCell from '../components/schedule/ScheduleSlotCell';
import { todayString } from '../utils/dateTime';
import useAppNotice from '../hooks/useAppNotice';
import './CustomerPage.css';

export default function CustomerPage() {
  const [day, setDay] = useState(todayString());
  const [daySlots, setDaySlots] = useState([]);
  const [courtCatalog, setCourtCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const { notice: message, setNotice: setMessage, clearNotice } = useAppNotice();
  const [selectedCourtIds, setSelectedCourtIds] = useState([]);
  const [beverages, setBeverages] = useState([]);

  function timeKey(value) {
    const dt = new Date(value);
    const hh = `${dt.getHours()}`.padStart(2, '0');
    const mm = `${dt.getMinutes()}`.padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function formatTime(value) {
    return new Date(value).toLocaleTimeString('vi-VN', {
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

  const courts = useMemo(
    () => [...courtCatalog].sort((a, b) => Number(a.id) - Number(b.id)),
    [courtCatalog]
  );

  useEffect(() => {
    setSelectedCourtIds((current) => current.filter((courtId) => courts.some((court) => String(court.id) === String(courtId))));
  }, [courts]);

  const courtFilterOptions = useMemo(
    () => courts.map((court) => ({
      value: String(court.id),
      label: court.name,
      description: court.court_type || 'Sân tiêu chuẩn'
    })),
    [courts]
  );

  const filteredCourts = useMemo(() => {
    if (selectedCourtIds.length === 0) return courts;
    const selected = new Set(selectedCourtIds.map(String));
    return courts.filter((court) => selected.has(String(court.id)));
  }, [courts, selectedCourtIds]);

  const courtSummary = useMemo(() => {
    if (selectedCourtIds.length === 0) return 'Tất cả sân';
    if (selectedCourtIds.length === 1) {
      return courts.find((court) => String(court.id) === String(selectedCourtIds[0]))?.name || '1 sân đã chọn';
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

  const heatmapGrid = useMemo(
    () => timeBands.map(({ startKey, label }) => ({
      time: startKey,
      label,
      cells: filteredCourts.map(
        (court) => daySlots.find(
          (slot) => String(slot.court_id) === String(court.id) && timeKey(slot.start_time) === startKey
        ) || null
      )
    })),
    [daySlots, filteredCourts, timeBands]
  );

  async function loadSlots() {
    setLoading(true);
    setMessage('');
    try {
      const response = await bookingApi.getDaySlots(day);
      const data = response.data?.data || [];
      setDaySlots(data);
      if (data.length === 0) setMessage('Chưa có lịch sân cho ngày này.');
    } catch (error) {
      setDaySlots([]);
      setMessage(error?.response?.data?.error?.message || 'Không thể tải lịch sân.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCourts() {
    try {
      const response = await bookingApi.listCourts();
      setCourtCatalog(response.data?.data || []);
    } catch {
      setCourtCatalog([]);
    }
  }

  async function loadBeverages() {
    try {
      const response = await beverageApi.list();
      setBeverages(response.data?.data || []);
    } catch {
      setBeverages([]);
    }
  }

  useEffect(() => {
    loadCourts();
    loadBeverages();
  }, []);

  useEffect(() => {
    loadSlots();
  }, [day]);

  return (
    <section className="panel customer customer-soft-layout">
      <AppToast message={message} onDismiss={clearNotice} />

      <ScheduleDateNavigator
        value={day}
        onChange={setDay}
        eyebrow="Lịch theo ngày"
        title="Lịch sân & dịch vụ"
        description="Chọn ngày và lọc theo sân để xem giá, lịch trống và tình trạng đặt chỗ. Việc đặt sân được thực hiện tại quầy bởi nhân viên hoặc quản trị viên."
      >
        <ScheduleCourtFilterBar
          options={courtFilterOptions}
          selectedValues={selectedCourtIds}
          onChange={setSelectedCourtIds}
          triggerLabel={courtSummary}
          visibleCourtCount={filteredCourts.length}
          totalCourtCount={courts.length}
          slotCount={timeBands.length}
        />
      </ScheduleDateNavigator>


      <div className="heatmap-wrapper soft-heatmap-wrapper" aria-busy={loading}>
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
                {cells.map((slot, index) => (
                  <ScheduleSlotCell key={slot?.id || `${time}-${index}`} slot={slot} mode="readonly" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCourts.length === 0 ? (
          <p className="message soft-message">Chưa có sân nào được chọn để hiển thị.</p>
        ) : null}

        {filteredCourts.length > 0 && timeBands.length === 0 && !loading ? (
          <p className="message soft-message">Ngày này chưa có dữ liệu lịch sân.</p>
        ) : null}
      </div>

      <div className="drink-board soft-drink-board">
        <div className="drink-board-header">
          <div>
            <h3>Quầy nước nhanh</h3>
            <p>Tham khảo đồ uống và dịch vụ có sẵn tại sân.</p>
          </div>
          <span className="drink-chip">Thông tin dịch vụ</span>
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
