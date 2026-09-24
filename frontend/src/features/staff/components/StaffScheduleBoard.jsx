import { addDays, formatDateFull, formatDateLabel, formatTime, todayString } from '../../../utils/dateTime';

function buildBookingNote(group) {
  if (!group) return '';
  const start = formatTime(group.start_time);
  const end = formatTime(group.end_time);
  const cleanNote = (group.booking_note || '').replace(/Đặt từ \d{2}:\d{2} đến \d{2}:\d{2}\s*\|?\s*/g, '').trim();
  if (!cleanNote) return `Đặt từ ${start} đến ${end}`;
  return cleanNote.startsWith('Ghi chú')
    ? `Đặt từ ${start} đến ${end} | ${cleanNote}`
    : `Đặt từ ${start} đến ${end} | Ghi chú: ${cleanNote}`;
}

export default function StaffScheduleBoard({
  viewDay,
  setViewDay,
  courtColumns,
  heatmapGrid,
  bookingGroups,
  selectedBookingSlotIds,
  groupInfoBySlotId,
  onCellClick
}) {
  return (
    <article className="staff-action-card staff-booking-board">
      <div className="staff-board-toolbar">
        <div>
          <h3>Bảng sân theo giờ</h3>
          <p>Bấm ô đã đặt để chọn booking, bấm ô trống để chọn giờ bắt đầu.</p>
        </div>
        <div className="staff-date-controls">
          <span>Xem ngày:</span>
          <div className="staff-date-shortcuts">
            {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
              const day = addDays(todayString(), offset);
              return (
                <button key={day} type="button" className={viewDay === day ? 'is-active' : ''} onClick={() => setViewDay(day)}>
                  {formatDateLabel(day)}
                </button>
              );
            })}
          </div>
          <input type="date" value={viewDay} onChange={(event) => setViewDay(event.target.value)} />
        </div>
      </div>

      <div className="staff-selected-date">
        <div><span aria-hidden="true">📅</span><strong>{formatDateFull(viewDay)}</strong></div>
        <div>
          <button type="button" onClick={() => setViewDay(addDays(viewDay, -1))}>← Hôm qua</button>
          <button type="button" onClick={() => setViewDay(addDays(viewDay, 1))}>Ngày mai →</button>
        </div>
      </div>

      <div className="heatmap-wrapper staff-heatmap-wrap">
        <table className="heatmap staff-heatmap-table">
          <thead>
            <tr>
              <th className="time-header">Giờ</th>
              {courtColumns.map((court) => (
                <th key={court.courtId} className="court-header">
                  <div className="court-header-content"><strong>{court.courtName}</strong><small>Sân {court.courtId}</small></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapGrid.map(({ time, label, cells }) => (
              <tr key={time} className="heatmap-row">
                <td className="time-cell">{label}</td>
                {cells.map((slot, index) => {
                  if (!slot) return <td key={`${time}-${index}`} className="heatmap-cell empty">-</td>;
                  if (!slot.booked) {
                    return (
                      <td key={slot.id || `${time}-${index}`} className="heatmap-cell free">
                        <button className="cell-button" type="button" onClick={() => onCellClick(slot)}>
                          <span className="cell-price">{Number(slot.price || 0).toLocaleString('vi-VN')}</span>
                          <span className="cell-label">Đặt</span>
                        </button>
                      </td>
                    );
                  }

                  const isSelected = selectedBookingSlotIds.has(String(slot.id));
                  const groupInfo = groupInfoBySlotId?.get?.(String(slot.id));
                  const group = bookingGroups.find((item) => item.groupKey === groupInfo?.groupKey);
                  const noteText = buildBookingNote(group);
                  return (
                    <td
                      key={slot.id || `${time}-${index}`}
                      className={`heatmap-cell booked ${slot.customer_type === 'monthly' ? 'customer-monthly' : 'customer-walkin'} ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => onCellClick(slot)}
                    >
                      <div className="cell-content">
                        <span className="booking-code">{slot.customer_name || 'Khách'}</span>
                        <span className="booking-time">{slot.customer_type === 'monthly' ? 'Khách tháng' : 'Khách vãng lai'}</span>
                        <span className="booking-time">{slot.booking_code || 'Booking'}{(groupInfo?.slotCount || 1) > 1 ? ` (${groupInfo.slotCount} slot)` : ''}{noteText ? ' 📝' : ''}</span>
                        {noteText ? <span className="staff-slot-note">{noteText}</span> : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
