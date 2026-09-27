import { useEffect, useMemo, useState } from 'react';
import AppDatePicker from '../ui/AppDatePicker';
import AppSelect from '../ui/AppSelect';
import { formatTime } from '../../utils/dateTime';
import { formatMoney } from '../../utils/formatters';

function sameBookingGroup(slot, bookingGroup) {
  if (!slot?.booked || !bookingGroup) return false;
  if (bookingGroup.booking_group_id && slot.booking_group_id) {
    return String(slot.booking_group_id) === String(bookingGroup.booking_group_id);
  }
  return (bookingGroup.booking_ids || []).some((id) => String(id) === String(slot.booking_id));
}

function slotIsSelectable(slot, bookingGroup) {
  return Boolean(slot) && (!slot.booked || sameBookingGroup(slot, bookingGroup));
}

function uniqueCourtOptions(slots = []) {
  const map = new Map();
  slots.forEach((slot) => {
    if (!map.has(String(slot.court_id))) {
      map.set(String(slot.court_id), {
        value: String(slot.court_id),
        label: slot.court_name || `Sân ${slot.court_id}`
      });
    }
  });
  return [...map.values()].sort((a, b) => Number(a.value) - Number(b.value));
}

export default function BookingScheduleEditor({
  bookingGroup,
  form,
  setForm,
  loadDaySlots,
  disabled = false
}) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const day = form.day || '';
  const courtId = String(form.courtId || bookingGroup?.court_id || '');

  useEffect(() => {
    if (!day || typeof loadDaySlots !== 'function') return undefined;
    let active = true;
    setLoading(true);
    setError('');
    Promise.resolve(loadDaySlots(day))
      .then((nextSlots) => {
        if (!active) return;
        setSlots(Array.isArray(nextSlots) ? nextSlots : []);
      })
      .catch((err) => {
        if (!active) return;
        setSlots([]);
        setError(err?.response?.data?.error?.message || err?.message || 'Không tải được lịch sân.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [day, loadDaySlots]);

  const courtOptions = useMemo(() => uniqueCourtOptions(slots), [slots]);

  const startOptions = useMemo(() => slots
    .filter((slot) => String(slot.court_id) === courtId && slotIsSelectable(slot, bookingGroup))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .map((slot) => ({
      value: String(slot.id),
      label: `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`
    })), [slots, courtId, bookingGroup]);

  const selectedStart = useMemo(
    () => slots.find((slot) => String(slot.id) === String(form.startTimeSlotId || '')) || null,
    [slots, form.startTimeSlotId]
  );

  const contiguousSlots = useMemo(() => {
    if (!selectedStart) return [];
    const sameCourt = slots
      .filter((slot) => String(slot.court_id) === String(selectedStart.court_id))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    const startIndex = sameCourt.findIndex((slot) => String(slot.id) === String(selectedStart.id));
    if (startIndex < 0) return [];

    const result = [];
    let expectedStart = new Date(selectedStart.start_time).getTime();
    for (let index = startIndex; index < sameCourt.length; index += 1) {
      const slot = sameCourt[index];
      const slotStart = new Date(slot.start_time).getTime();
      if (slotStart !== expectedStart || !slotIsSelectable(slot, bookingGroup)) break;
      result.push(slot);
      expectedStart = new Date(slot.end_time).getTime();
    }
    return result;
  }, [slots, selectedStart, bookingGroup]);

  const endOptions = useMemo(() => {
    if (!selectedStart) return [];
    const startMs = new Date(selectedStart.start_time).getTime();
    return contiguousSlots.map((slot, index) => {
      const duration = Math.round((new Date(slot.end_time).getTime() - startMs) / 60000);
      return {
        value: String(slot.id),
        label: `${formatTime(slot.end_time)} (${duration} phút)`,
        count: index + 1
      };
    });
  }, [contiguousSlots, selectedStart]);

  const selectedSlotIds = useMemo(() => {
    if (!selectedStart) return [];
    const endId = String(form.rescheduleEndSlotId || selectedStart.id);
    const endIndex = contiguousSlots.findIndex((slot) => String(slot.id) === endId);
    const take = endIndex >= 0 ? endIndex + 1 : 1;
    return contiguousSlots.slice(0, take).map((slot) => Number(slot.id));
  }, [contiguousSlots, selectedStart, form.rescheduleEndSlotId]);

  const previewTotal = useMemo(() => {
    const selected = new Set(selectedSlotIds.map(String));
    return slots
      .filter((slot) => selected.has(String(slot.id)))
      .reduce((sum, slot) => sum + Number(slot.price || 0), 0);
  }, [slots, selectedSlotIds]);

  useEffect(() => {
    if (!selectedSlotIds.length) return;
    const sameIds = (form.rescheduleSlotIds || []).map(String).join(',') === selectedSlotIds.map(String).join(',');
    const sameTotal = Number(form.schedulePreviewTotal || 0) === Number(previewTotal || 0);
    if (sameIds && sameTotal) return;
    setForm((current) => ({
      ...current,
      rescheduleSlotIds: selectedSlotIds,
      schedulePreviewTotal: previewTotal
    }));
  }, [selectedSlotIds, previewTotal, form.rescheduleSlotIds, form.schedulePreviewTotal, setForm]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeDay(value) {
    setForm((current) => ({
      ...current,
      day: value,
      courtId: current.courtId || String(bookingGroup?.court_id || ''),
      startTimeSlotId: '',
      rescheduleEndSlotId: '',
      rescheduleSlotIds: [],
      schedulePreviewTotal: 0
    }));
  }

  function changeCourt(value) {
    setForm((current) => ({
      ...current,
      courtId: value,
      startTimeSlotId: '',
      rescheduleEndSlotId: '',
      rescheduleSlotIds: [],
      schedulePreviewTotal: 0
    }));
  }

  function changeStart(value) {
    setForm((current) => ({
      ...current,
      startTimeSlotId: value,
      rescheduleEndSlotId: value,
      rescheduleSlotIds: [Number(value)]
    }));
  }

  return (
    <section className="booking-schedule-editor booking-modal-wide" aria-label="Lịch đặt sân">
      <div className="booking-modal-section-heading">
        <div>
          <h4>Lịch đặt sân</h4>
          <p>Có thể đổi sân, ngày và khung giờ. Hệ thống sẽ kiểm tra trùng lịch và tính lại giá trước khi lưu.</p>
        </div>
        <div className="booking-schedule-total">
          <span>Tạm tính</span>
          <strong>{formatMoney(previewTotal || bookingGroup?.total_price || 0)} VND</strong>
        </div>
      </div>

      <div className="booking-schedule-grid">
        <div className="operation-field">
          <span>Sân</span>
          <AppSelect
            value={courtId}
            onChange={changeCourt}
            options={courtOptions}
            placeholder={loading ? 'Đang tải...' : 'Chọn sân'}
            ariaLabel="Chọn sân"
            disabled={disabled || loading}
          />
        </div>

        <div className="operation-field">
          <span>Ngày</span>
          <AppDatePicker
            value={day}
            onChange={changeDay}
            ariaLabel="Chọn ngày đặt sân"
          />
        </div>

        <div className="operation-field">
          <span>Giờ bắt đầu</span>
          <AppSelect
            value={String(form.startTimeSlotId || '')}
            onChange={changeStart}
            options={startOptions}
            placeholder={loading ? 'Đang tải...' : 'Chọn giờ bắt đầu'}
            ariaLabel="Giờ bắt đầu"
            disabled={disabled || loading || !courtId}
          />
        </div>

        <div className="operation-field">
          <span>Giờ kết thúc</span>
          <AppSelect
            value={String(form.rescheduleEndSlotId || '')}
            onChange={(value) => update('rescheduleEndSlotId', value)}
            options={endOptions}
            placeholder="Chọn giờ kết thúc"
            ariaLabel="Giờ kết thúc"
            disabled={disabled || loading || !selectedStart}
          />
        </div>
      </div>

      {error ? <p className="booking-schedule-error">{error}</p> : null}
      {!loading && selectedStart && selectedSlotIds.length === 0 ? (
        <p className="booking-schedule-error">Khung giờ đã chọn không còn khả dụng.</p>
      ) : null}
    </section>
  );
}
