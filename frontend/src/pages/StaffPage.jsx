import { useCallback, useEffect, useMemo, useState } from 'react';
import { staffApi } from '../services/api';
import { formatTime, slotMinuteOfDay, todayString } from '../utils/dateTime';
import { buildHeatmapGrid, compareSlotTime, findBookingGroupForSlot, getAvailableRangeEndSlots, groupBookedSlots } from '../utils/bookingGrid';
import { formatMoney, paymentMethodLabel } from '../utils/formatters';
import { allocatePaymentAcrossSlots, bookingGroupToForm, createBookingForm, resolvePaymentTotal } from '../utils/bookingForm';
import StaffOperationsView from '../features/staff/StaffOperationsView';
import './StaffPage.css';
import './StaffScheduleBoard.css';
import useAppNotice from '../hooks/useAppNotice';
import { getApiErrorMessage } from '../utils/apiErrorMessage';

export default function StaffPage() {
  const { notice: message, setNotice: setMessage, clearNotice } = useAppNotice({ text: 'Nhân viên chỉ xử lý vận hành booking, không có quyền cấu hình sân.', tone: 'info' });
  const [loading, setLoading] = useState(false);
  const [checkInCode, setCheckInCode] = useState('');
  const [lastCheckin, setLastCheckin] = useState(null);
  const [checkinFeed, setCheckinFeed] = useState([]);
  const [selectedBookingKey, setSelectedBookingKey] = useState(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingDialogMode, setBookingDialogMode] = useState('create');
  const [bookingForm, setBookingForm] = useState(createBookingForm({ day: todayString() }));
  const [daySlots, setDaySlots] = useState([]);
  const [viewDay, setViewDay] = useState(todayString());

  const sortedSlots = useMemo(() => [...(daySlots || [])].sort(compareSlotTime), [daySlots]);

  const groupedSlotsByCourt = useMemo(() => {
    const grouped = new Map();
    sortedSlots.forEach((slot) => {
      const key = `${slot.court_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(slot);
    });

    return [...grouped.entries()].map(([courtId, slots]) => {
      const byMinute = new Map();
      slots.forEach((slot) => byMinute.set(slotMinuteOfDay(slot.start_time), slot));
      const orderedSlots = [];
      for (let minute = 0; minute < 24 * 60; minute += 30) {
        const slot = byMinute.get(minute);
        if (slot) orderedSlots.push(slot);
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
  const heatmapGrid = useMemo(() => buildHeatmapGrid(sortedSlots, courtColumns), [sortedSlots, courtColumns]);
  const bookingGroups = useMemo(() => groupBookedSlots(sortedSlots.filter((slot) => slot.booked)), [sortedSlots]);
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
    () => sortedSlots.find((slot) => String(slot.id) === String(bookingForm.startTimeSlotId)) || selectedBooking?.slots?.[0] || null,
    [sortedSlots, bookingForm.startTimeSlotId, selectedBooking]
  );
  const endSlots = useMemo(
    () => bookingDialogMode === 'create' ? getAvailableRangeEndSlots(sortedSlots, selectedStartSlot) : [],
    [sortedSlots, selectedStartSlot, bookingDialogMode]
  );

  async function loadSlots(day) {
    try {
      const res = await staffApi.getDaySlots(day);
      const nextSlots = res.data?.data || [];
      setDaySlots(nextSlots);
      const groups = groupBookedSlots(nextSlots.filter((slot) => slot.booked));
      setSelectedBookingKey((prev) => (prev && groups.some((group) => group.groupKey === prev) ? prev : null));
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error, 'Không tải được lịch trong ngày.'), tone: 'error' });
    }
  }

  const loadBookingScheduleSlots = useCallback(async (targetDay) => {
    const response = await staffApi.getDaySlots(targetDay);
    return response.data?.data || [];
  }, []);

  function handleDeskCellClick(slot) {
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
      setSelectedBookingKey(group.groupKey);
      setBookingDialogMode('edit');
      setBookingForm(bookingGroupToForm(group));
      setBookingDialogOpen(true);
      return;
    }

    setSelectedBookingKey(null);
    setBookingDialogMode('create');
    setBookingForm(createBookingForm({
      day: viewDay,
      startTimeSlotId: String(slot.id)
    }));
    setBookingDialogOpen(true);
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
      setMessage({ text: `Đã tìm thấy booking ${booking?.booking_code || ''} (trạng thái: ${booking?.status || '-'})`, tone: 'success' });
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error, 'Check-in thất bại.'), tone: 'error' });
    }
  }

  async function createBookingForCustomer(e) {
    e.preventDefault();
    if (!bookingForm.startTimeSlotId || !bookingForm.customerPhone.trim() || !bookingForm.customerName.trim()) {
      setMessage({ text: 'Vui lòng nhập đầy đủ số điện thoại và tên khách.', tone: 'error' });
      return;
    }

    const isSingleSlot = !bookingForm.endTimeSlotId || bookingForm.endTimeSlotId === 'single';
    const payload = {
      customer_phone: bookingForm.customerPhone.trim(),
      customer_name: bookingForm.customerName.trim(),
      customer_type: bookingForm.customerType,
      display_color: bookingForm.displayColor,
      notes: bookingForm.notes.trim(),
      ...(isSingleSlot
        ? { time_slot_id: Number(bookingForm.startTimeSlotId) }
        : {
            start_time_slot_id: Number(bookingForm.startTimeSlotId),
            end_time_slot_id: Number(bookingForm.endTimeSlotId)
          })
    };

    setLoading(true);
    try {
      const res = await staffApi.createBookingForCustomer(payload);
      const responseData = res.data?.data;
      const bookings = responseData?.bookings || (responseData ? [responseData] : []);
      const totalPrice = bookings.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);
      const paymentTotal = resolvePaymentTotal(bookingForm, totalPrice);
      const allocations = allocatePaymentAcrossSlots(bookings, paymentTotal);

      for (let index = 0; index < bookings.length; index += 1) {
        if (!bookings[index]?.id) continue;
        await staffApi.updateBooking(bookings[index].id, {
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
      setBookingForm(createBookingForm({ day: viewDay }));
      await loadSlots(viewDay);
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error, 'Không tạo được booking cho khách.'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function updateSelectedBooking(e) {
    e.preventDefault();
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
      await staffApi.updateBookingGroup(anchorBookingId, {
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

      const bookingCode = selectedBooking.booking_code;
      const targetDay = bookingForm.day || viewDay;
      setBookingDialogOpen(false);
      setSelectedBookingKey(null);
      if (targetDay !== viewDay) {
        setViewDay(targetDay);
      } else {
        await loadSlots(viewDay);
      }
      setMessage({ text: `Đã cập nhật booking ${bookingCode}.`, tone: 'success' });
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error, 'Không cập nhật được booking.'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function cancelSelectedBooking(reason) {
    if (!selectedBooking?.slots?.length || !reason?.trim()) {
      setMessage({ text: 'Vui lòng nhập lý do hủy booking.', tone: 'error' });
      return;
    }

    setLoading(true);
    try {
      for (const slot of selectedBooking.slots) {
        if (slot.booking_id) await staffApi.cancelBooking(slot.booking_id, reason.trim());
      }
      const bookingCode = selectedBooking.booking_code || 'booking';
      setSelectedBookingKey(null);
      setBookingDialogOpen(false);
      await loadSlots(viewDay);
      setMessage({ text: `Đã hủy booking ${bookingCode} và giải phóng lịch sân.`, tone: 'success' });
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error, 'Không thể hủy booking.'), tone: 'error' });
      throw error;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSlots(viewDay);
  }, [viewDay]);

  const notifyError = (text) => setMessage({ text, tone: 'error' });

  return (
    <StaffOperationsView
      vm={{
        message, loading, checkInCode, setCheckInCode, lastCheckin, checkinFeed,
        bookingDialogOpen, setBookingDialogOpen, bookingDialogMode,
        bookingForm, setBookingForm, viewDay, setViewDay, courtColumns, heatmapGrid,
        bookingGroups, selectedBooking, selectedBookingSlotIds, groupInfoBySlotId,
        selectedStartSlot, endSlots, handleDeskCellClick, doCheckin,
        createBookingForCustomer, updateSelectedBooking, cancelSelectedBooking, loadBookingScheduleSlots, clearNotice, notifyError
      }}
    />
  );
}
