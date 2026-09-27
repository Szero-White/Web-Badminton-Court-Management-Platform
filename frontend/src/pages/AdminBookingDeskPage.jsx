import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../services/api';
import { formatDayInput } from '../utils/dateTime';
import { buildHeatmapGrid, findBookingGroupForSlot, getAvailableRangeEndSlots, groupBookedSlots } from '../utils/bookingGrid';
import { formatMoney, paymentMethodLabel } from '../utils/formatters';
import { allocatePaymentAcrossSlots, bookingGroupToForm, createBookingForm, resolvePaymentTotal } from '../utils/bookingForm';
import AdminBookingDeskView from '../features/admin-booking/AdminBookingDeskView';
import './AdminBookingDeskPage.css';
import useAppNotice from '../hooks/useAppNotice';
import { getApiErrorMessage } from '../utils/apiErrorMessage';

export default function AdminBookingDeskPage() {
  const [day, setDay] = useState(formatDayInput());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const { notice: message, setNotice: setMessage, clearNotice } = useAppNotice();
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedBookingKey, setSelectedBookingKey] = useState(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingDialogMode, setBookingDialogMode] = useState('create');
  const [bookingForm, setBookingForm] = useState(createBookingForm());

  const courts = useMemo(() => {
    const map = new Map();
    slots.forEach((slot) => {
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
  const bookingGroups = useMemo(() => groupBookedSlots(slots.filter((slot) => slot.booked)), [slots]);
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
      group.slots?.forEach((slot) => {
        map.set(String(slot.id), { slotCount: group.slots?.length || 1, groupKey: group.groupKey });
      });
    });
    return map;
  }, [bookingGroups]);

  const selectedStartSlot = useMemo(
    () => selectedSlot || selectedBooking?.slots?.[0] || null,
    [selectedSlot, selectedBooking]
  );
  const endSlots = useMemo(
    () => bookingDialogMode === 'create' ? getAvailableRangeEndSlots(slots, selectedSlot) : [],
    [slots, selectedSlot, bookingDialogMode]
  );

  async function loadData() {
    setLoading(true);
    setMessage('');
    try {
      const res = await adminApi.getDaySlots(day);
      const data = res.data?.data || [];
      setSlots(data);
    } catch (err) {
      setMessage({ text: getApiErrorMessage(err, 'Không thể tải lịch đặt sân.'), tone: 'error' });
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [day]);

  const loadBookingScheduleSlots = useCallback(async (targetDay) => {
    const response = await adminApi.getDaySlots(targetDay);
    return response.data?.data || [];
  }, []);

  function handleCellClick(slot) {
    clearNotice();
    if (!slot) {
      setMessage({ text: 'Không xác định được khung giờ đã chọn.', tone: 'error' });
      return;
    }

    if (slot.booked) {
      const group = findBookingGroupForSlot(bookingGroups, slot);
      if (!group) {
        setMessage({ text: 'Không tìm thấy thông tin booking của khung giờ này. Vui lòng tải lại lịch.', tone: 'error' });
        return;
      }
      setSelectedSlot(slot);
      setSelectedBookingKey(group.groupKey);
      setBookingDialogMode('edit');
      setBookingForm(bookingGroupToForm(group));
      setBookingDialogOpen(true);
      return;
    }

    setSelectedSlot(slot);
    setSelectedBookingKey(null);
    setBookingDialogMode('create');
    setBookingForm(createBookingForm({
      day,
      startTimeSlotId: String(slot.id)
    }));
    setBookingDialogOpen(true);
  }

  async function handleCreateBooking(event) {
    event.preventDefault();
    if (!selectedSlot || !bookingForm.customerName.trim() || !bookingForm.customerPhone.trim()) {
      setMessage({ text: 'Vui lòng nhập đầy đủ tên và số điện thoại.', tone: 'error' });
      return;
    }

    const isSingleSlot = !bookingForm.endTimeSlotId || bookingForm.endTimeSlotId === 'single';
    const payload = {
      customer_name: bookingForm.customerName.trim(),
      customer_phone: bookingForm.customerPhone.trim(),
      customer_type: bookingForm.customerType,
      display_color: bookingForm.displayColor,
      notes: bookingForm.notes.trim(),
      ...(isSingleSlot
        ? { time_slot_id: Number(selectedSlot.id) }
        : {
            start_time_slot_id: Number(selectedSlot.id),
            end_time_slot_id: Number(bookingForm.endTimeSlotId)
          })
    };

    setLoading(true);
    try {
      const response = await adminApi.createBooking(payload);
      const responseData = response.data?.data;
      const bookings = responseData?.bookings || (responseData ? [responseData] : []);
      const totalPrice = bookings.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);
      const paymentTotal = resolvePaymentTotal(bookingForm, totalPrice);
      const allocations = allocatePaymentAcrossSlots(bookings, paymentTotal);

      for (let index = 0; index < bookings.length; index += 1) {
        if (!bookings[index]?.id) continue;
        await adminApi.updateBooking(bookings[index].id, {
          payment_total: allocations[index],
          payment_method: bookingForm.paymentMethod,
          payment_reference: bookingForm.paymentReference?.trim() || '',
          display_color: bookingForm.displayColor
        });
      }

      const bookingCode = bookings[0]?.booking_code || 'booking';
      const paymentMsg = paymentTotal > 0
        ? ` Đã thu ${formatMoney(paymentTotal)} VND (${paymentMethodLabel(bookingForm.paymentMethod)}).`
        : '';
      setMessage({ text: `Đặt sân thành công. Mã booking: ${bookingCode}.${paymentMsg}`, tone: 'success' });
      setBookingDialogOpen(false);
      setSelectedSlot(null);
      setBookingForm(createBookingForm({ day }));
      await loadData();
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error, 'Không thể tạo booking.'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateBooking(event) {
    event.preventDefault();
    if (!selectedBooking?.slots?.length) {
      setMessage({ text: 'Không tìm thấy dữ liệu booking để cập nhật. Vui lòng đóng cửa sổ và thử lại.', tone: 'error' });
      return;
    }

    const targetSlotIds = (bookingForm.rescheduleSlotIds || []).map(Number).filter(Boolean);
    if (targetSlotIds.length === 0) {
      setMessage({ text: 'Vui lòng chọn đầy đủ sân và khung giờ mới.', tone: 'error' });
      return;
    }

    const totalPrice = Number(bookingForm.schedulePreviewTotal || selectedBooking.total_price || 0);
    const paymentTotal = resolvePaymentTotal(bookingForm, totalPrice);
    const previousPaid = Number(selectedBooking.deposit_paid || 0);
    if (paymentTotal < previousPaid && !bookingForm.paymentAdjustmentReason.trim()) {
      setMessage({ text: 'Vui lòng nhập lý do khi giảm số tiền đã thu.', tone: 'error' });
      return;
    }

    const anchorBookingId = selectedBooking.slots.find((slot) => slot.booking_id)?.booking_id;
    if (!anchorBookingId) {
      setMessage({ text: 'Không xác định được booking cần cập nhật.', tone: 'error' });
      return;
    }

    setLoading(true);
    try {
      await adminApi.updateBookingGroup(anchorBookingId, {
        time_slot_ids: targetSlotIds,
        customer_name: bookingForm.customerName.trim(),
        customer_phone: bookingForm.customerPhone.trim(),
        customer_type: bookingForm.customerType,
        notes: bookingForm.notes.trim(),
        payment_total: paymentTotal,
        payment_method: bookingForm.paymentMethod,
        payment_reference: bookingForm.paymentReference?.trim() || '',
        payment_adjustment_reason: bookingForm.paymentAdjustmentReason?.trim() || '',
        display_color: bookingForm.displayColor
      });

      const targetDay = bookingForm.day || day;
      setMessage({ text: `Đã cập nhật booking ${selectedBooking.booking_code}.`, tone: 'success' });
      setBookingDialogOpen(false);
      setSelectedBookingKey(null);
      setSelectedSlot(null);
      if (targetDay !== day) {
        setDay(targetDay);
      } else {
        await loadData();
      }
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error, 'Không thể cập nhật booking.'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBooking() {
    if (!selectedBooking?.slots?.length) return;
    const reason = window.prompt(`Nhập lý do hủy booking ${selectedBooking.booking_code}:`);
    if (reason === null || !window.confirm(`Hủy booking ${selectedBooking.booking_code} gồm ${selectedBooking.slots.length} khung giờ?`)) return;

    setLoading(true);
    try {
      for (const slot of selectedBooking.slots) {
        if (slot.booking_id) await adminApi.deleteBooking(slot.booking_id, reason || 'Quản trị viên hủy booking');
      }
      setSelectedBookingKey(null);
      setBookingDialogOpen(false);
      setMessage({ text: 'Đã hủy booking và cập nhật lịch.', tone: 'success' });
      await loadData();
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error, 'Không thể hủy booking.'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const notifyError = (text) => setMessage({ text, tone: 'error' });

  return (
    <AdminBookingDeskView
      vm={{
        day, setDay, slots, loading, message, selectedSlot,
        bookingDialogOpen, setBookingDialogOpen, bookingDialogMode,
        bookingForm, setBookingForm, courts, heatmapGrid, bookingGroups,
        selectedBooking, selectedBookingSlotIds, groupInfoBySlotId, selectedStartSlot, endSlots,
        handleCellClick, handleCreateBooking, handleUpdateBooking, handleDeleteBooking, loadBookingScheduleSlots, clearNotice, notifyError
      }}
    />
  );
}
