import { useEffect, useMemo, useState } from 'react';
import { adminApi, bookingApi } from '../services/api';
import { formatDayInput } from '../utils/dateTime';
import { buildHeatmapGrid, findBookingGroupForSlot, getAvailableRangeEndSlots, groupBookedSlots } from '../utils/bookingGrid';
import { buildDepositNote, formatMoney, paymentMethodLabel } from '../utils/formatters';
import AdminBookingDeskView from '../features/admin-booking/AdminBookingDeskView';
import './AdminBookingDeskPage.css';

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
    endTimeSlotId: 'single',
    customerName: '',
    customerPhone: '',
    customerType: 'walk_in',
    notes: '',
    collectDeposit: false,
    depositAmount: '',
    depositMethod: 'transfer',
    depositReference: ''
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

  const endSlots = useMemo(
    () => getAvailableRangeEndSlots(slots, selectedSlot),
    [slots, selectedSlot]
  );

  async function loadData() {
    setLoading(true);
    setMessage('');
    try {
      const res = await adminApi.getDaySlots(day);
      const data = res.data?.data || [];
      setSlots(data);
      setMessage(`Đã tải ${data.length} slot cho ngày ${day}`);
    } catch (err) {
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
      const group = findBookingGroupForSlot(bookingGroups, slot);
      const groupKey = group?.groupKey || null;
      setSelectedBookingKey(groupKey);
      setSelectedSlot(slot);
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
        endTimeSlotId: 'single',
        customerName: '',
        customerPhone: '',
        customerType: 'walk_in',
        notes: '',
        collectDeposit: false,
        depositAmount: '',
        depositMethod: 'transfer',
        depositReference: ''
      });
      setMessage(`Đã chọn ${slot.court_name || `Sân ${slot.court_id}`} lúc ${new Date(slot.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}.`);
    }
  }

  async function handleCreateBooking(event) {
    event.preventDefault();
    if (!selectedSlot || !bookingData.customerName.trim() || !bookingData.customerPhone.trim()) {
      setMessage('Vui lòng nhập đầy đủ tên và số điện thoại.');
      return;
    }

    const depositEnabled = Boolean(bookingData.collectDeposit);
    const depositAmount = Math.round(Number(bookingData.depositAmount || 0));
    if (depositEnabled && (!Number.isFinite(depositAmount) || depositAmount <= 0)) {
      setMessage('Nếu chọn cọc trước, vui lòng nhập số tiền cọc hợp lệ.');
      return;
    }

    const composedNote = depositEnabled
      ? buildDepositNote(bookingData.notes, depositAmount, bookingData.depositMethod, bookingData.depositReference)
      : bookingData.notes.trim();

    const isSingleSlot = !bookingData.endTimeSlotId || bookingData.endTimeSlotId === 'single';
    const payload = {
      customer_name: bookingData.customerName.trim(),
      customer_phone: bookingData.customerPhone.trim(),
      customer_type: bookingData.customerType,
      notes: composedNote,
      ...(isSingleSlot
        ? { time_slot_id: Number(selectedSlot.id) }
        : {
            start_time_slot_id: Number(selectedSlot.id),
            end_time_slot_id: Number(bookingData.endTimeSlotId)
          })
    };

    setLoading(true);
    try {
      const response = await adminApi.createBooking(payload);
      const responseData = response.data?.data;
      const bookings = responseData?.bookings || (responseData ? [responseData] : []);
      const bookingCode = bookings[0]?.booking_code || 'booking';

      let deposited = 0;
      if (depositEnabled && bookings.length > 0) {
        let remaining = depositAmount;
        for (const booking of bookings) {
          if (!booking?.id || remaining <= 0) continue;

          const cap = Number(booking.remaining_due ?? booking.total_price ?? 0);
          const amountToPay = Math.min(remaining, cap > 0 ? cap : remaining);
          if (amountToPay <= 0) continue;

          await bookingApi.confirmDeposit(booking.id, {
            amount: amountToPay,
            method: bookingData.depositMethod,
            reference: bookingData.depositReference?.trim() || ''
          });
          deposited += amountToPay;
          remaining -= amountToPay;
        }
      }

      const depositMsg = deposited > 0
        ? ` Đã ghi nhận cọc ${formatMoney(deposited)} VND (${paymentMethodLabel(bookingData.depositMethod)}).`
        : '';
      setMessage(`Đặt sân thành công. Mã booking: ${bookingCode}.${depositMsg}`);
      setShowBookingForm(false);
      setSelectedSlot(null);
      setBookingData({
        endTimeSlotId: 'single',
        customerName: '',
        customerPhone: '',
        customerType: 'walk_in',
        notes: '',
        collectDeposit: false,
        depositAmount: '',
        depositMethod: 'transfer',
        depositReference: ''
      });
      await loadData();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể tạo booking.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateBooking() {
    if (!selectedBooking?.slots?.length) return;
    const targetDeposit = Math.round(Number(bookingEditForm.deposit) || 0);
    const totalPrice = selectedBooking.slots.reduce((sum, slot) => sum + Number(slot.price || 0), 0);
    if (targetDeposit < 0 || targetDeposit > totalPrice) {
      setMessage('Tổng tiền cọc không hợp lệ.');
      return;
    }

    setLoading(true);
    try {
      let remainingDeposit = targetDeposit;
      for (const slot of selectedBooking.slots) {
        if (!slot.booking_id) continue;
        const slotDeposit = Math.min(remainingDeposit, Number(slot.price || 0));
        await adminApi.updateBooking(slot.booking_id, {
          customer_name: bookingEditForm.customerName.trim(),
          customer_phone: bookingEditForm.customerPhone.trim(),
          customer_type: bookingEditForm.customerType,
          notes: bookingEditForm.notes.trim(),
          deposit_total: slotDeposit
        });
        remainingDeposit -= slotDeposit;
      }
      setMessage('Cập nhật booking thành công.');
      setIsEditingBooking(false);
      await loadData();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể cập nhật booking.');
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
      setIsEditingBooking(false);
      setMessage('Đã hủy booking và cập nhật lịch.');
      await loadData();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể hủy booking.');
    } finally {
      setLoading(false);
    }
  }

  return <AdminBookingDeskView vm={{ day, setDay, slots, loading, message, selectedSlot, setSelectedSlot, selectedBookingKey, setSelectedBookingKey, showBookingForm, setShowBookingForm, bookingData, setBookingData, bookingEditForm, setBookingEditForm, isEditingBooking, setIsEditingBooking, courts, heatmapGrid, bookingGroups, selectedBooking, selectedBookingSlotIds, groupInfoBySlotId, endSlots, loadData, handleCellClick, handleCreateBooking, handleUpdateBooking, handleDeleteBooking }} />;
}
