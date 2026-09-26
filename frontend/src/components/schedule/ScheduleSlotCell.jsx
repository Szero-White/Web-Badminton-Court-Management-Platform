import { bookingStatusLabel, bookingTypeLabel, bookingTypeTone } from '../../utils/bookingPresentation';

function priceLabel(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

export default function ScheduleSlotCell({
  slot,
  mode = 'manage',
  selected = false,
  onSelect,
  slotCount = 1,
  rangeText = '',
  note = ''
}) {
  if (!slot) {
    return <td className="heatmap-cell empty">-</td>;
  }

  const interactive = mode === 'manage' && typeof onSelect === 'function';

  if (!slot.booked) {
    return (
      <td className="heatmap-cell free schedule-slot-cell schedule-slot-cell--available">
        {interactive ? (
          <button
            type="button"
            className="schedule-slot-card schedule-slot-card--interactive"
            onClick={() => onSelect(slot)}
            aria-label={`Đặt ${slot.court_name || `sân ${slot.court_id}`} lúc ${new Date(slot.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
          >
            <strong className="schedule-slot-price">{priceLabel(slot.price)}</strong>
            <span className="schedule-slot-action">Đặt sân</span>
          </button>
        ) : (
          <div className="schedule-slot-card schedule-slot-card--readonly" aria-label="Sân còn trống">
            <strong className="schedule-slot-price">{priceLabel(slot.price)}</strong>
            <span className="schedule-slot-availability">Còn trống</span>
          </div>
        )}
      </td>
    );
  }

  const customerType = slot.customer_type || '';
  const typeTone = bookingTypeTone(customerType);
  const typeLabel = bookingTypeLabel(customerType);
  const statusLabel = bookingStatusLabel(slot.status);
  const privateDetails = mode === 'manage';
  const bookingCode = slot.booking_code || '';
  const customerName = slot.customer_name || '';

  const content = (
    <div className="schedule-slot-card-content">
      <div className="schedule-slot-badges">
        <span className={`schedule-slot-type schedule-slot-type--${typeTone}`}>{typeLabel}</span>
        <span className="schedule-slot-status">{statusLabel}</span>
      </div>
      {privateDetails ? (
        <>
          <strong className="schedule-slot-customer">{customerName || 'Khách tại quầy'}</strong>
          <span className="schedule-slot-meta">
            {bookingCode || 'Booking'}{slotCount > 1 ? ` · ${slotCount} slot` : ''}
          </span>
          {rangeText ? <span className="schedule-slot-range">{rangeText}</span> : null}
          {note ? <span className="schedule-slot-note" title={note}>Có ghi chú</span> : null}
        </>
      ) : (
        <span className="schedule-slot-public-copy">Khung giờ đã có lịch</span>
      )}
    </div>
  );

  return (
    <td className={`heatmap-cell booked schedule-slot-cell schedule-slot-cell--${typeTone} ${selected ? 'is-selected' : ''}`}>
      {interactive ? (
        <button
          type="button"
          className="schedule-slot-card schedule-slot-card--interactive schedule-slot-card--booked"
          onClick={() => onSelect(slot)}
          aria-label={`${typeLabel}, ${customerName || 'khách'}, ${statusLabel}`}
        >
          {content}
        </button>
      ) : (
        <div className="schedule-slot-card schedule-slot-card--readonly schedule-slot-card--booked">
          {content}
        </div>
      )}
    </td>
  );
}
