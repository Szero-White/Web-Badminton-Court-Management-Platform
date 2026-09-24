import { useEffect, useMemo, useState } from 'react';
import { bookingApi, staffApi } from '../services/api';
import { formatTime, slotMinuteOfDay, todayString } from '../utils/dateTime';
import { buildHeatmapGrid, compareSlotTime, findBookingGroupForSlot, groupBookedSlots } from '../utils/bookingGrid';
import { buildDepositNote, formatMoney } from '../utils/formatters';
import StaffOperationsView from '../features/staff/StaffOperationsView';
import './StaffPage.css';
import './StaffScheduleBoard.css';

export default function StaffPage() {
  const [message, setMessage] = useState('Nhân viên chỉ xử lý vận hành booking, không có quyền cấu hình sân.');
  const [loading, setLoading] = useState(false);
  const [checkInCode, setCheckInCode] = useState('');
  const [lastCheckin, setLastCheckin] = useState(null);
  const [checkinFeed, setCheckinFeed] = useState([]);
  const [selectedBookingKey, setSelectedBookingKey] = useState(null);
  const [depositEdit, setDepositEdit] = useState({ amount: '', method: 'transfer', reference: '' });
  
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
      setSelectedBookingKey(findBookingGroupForSlot(bookingGroups, slot)?.groupKey || null);
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
      const res = await staffApi.getDaySlots(day);
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
      const res = await staffApi.createBookingForCustomer({
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

  return <StaffOperationsView vm={{ message, loading, checkInCode, setCheckInCode, lastCheckin, checkinFeed, selectedBookingKey, setSelectedBookingKey, depositEdit, setDepositEdit, bookingForm, setBookingForm, viewDay, setViewDay, courtColumns, heatmapGrid, groupedSlotsByCourt, bookingGroups, selectedBooking, selectedBookingSlotIds, groupInfoBySlotId, selectedStartSlot, endSlots, handleDeskCellClick, loadSlots, confirmSelectedDeposit, doCheckin, createBookingForCustomer }} />;
}
