import { bookingStatusLabel, bookingTypeLabel, buildBookingHoverDetails } from '../../utils/bookingPresentation';

function priceLabel(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function normalizeHex(hex, fallback = '#6f9f94') {
  const value = String(hex || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

function mixWithWhite(hex, whiteRatio = 0.78) {
  const value = normalizeHex(hex).slice(1);
  const ratio = Math.min(0.92, Math.max(0, whiteRatio));
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const mixed = channels.map((channel) => Math.round(channel * (1 - ratio) + 255 * ratio));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export default function ScheduleSlotCell({
  slot,
  mode = 'manage',
  selected = false,
  onSelect,
  slotCount = 1,
  rangeText = '',
  note = '',
  bookingGroup = null
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

  const typeLabel = bookingTypeLabel(slot.customer_type || '');
  const status = String(slot.status || '').toLowerCase();
  const statusLabel = bookingStatusLabel(slot.status);
  const showStatus = status && !['confirmed', 'booked'].includes(status);
  const privateDetails = mode === 'manage';
  const customerName = slot.customer_name || '';
  const displayColor = normalizeHex(slot.display_color);
  const hoverDetails = privateDetails
    ? buildBookingHoverDetails(bookingGroup, {
      ...slot,
      booking_note: note,
      start_time: bookingGroup?.start_time || slot.start_time,
      end_time: bookingGroup?.end_time || slot.end_time
    })
    : '';

  const cardStyle = {
    background: mixWithWhite(displayColor, 0.78),
    color: '#30413e',
    borderColor: mixWithWhite(displayColor, 0.42),
    '--booking-slot-color': displayColor,
    '--booking-slot-soft': mixWithWhite(displayColor, 0.78)
  };

  const content = (
    <div className="schedule-slot-card-content">
      <div className="schedule-slot-badges">
        <span className="schedule-slot-type">{typeLabel}</span>
        {showStatus ? <span className="schedule-slot-status">{statusLabel}</span> : null}
      </div>
      {privateDetails ? (
        <>
          <strong className="schedule-slot-customer">{customerName || 'Khách tại quầy'}</strong>
          <span className="schedule-slot-summary">
            {rangeText || 'Đã đặt'}{slotCount > 1 ? ` · ${slotCount} khung` : ''}
          </span>
        </>
      ) : (
        <span className="schedule-slot-public-copy">Khung giờ đã có lịch</span>
      )}
    </div>
  );

  return (
    <td className={`heatmap-cell booked schedule-slot-cell schedule-slot-cell--booked ${selected ? 'is-selected' : ''}`}>
      {interactive ? (
        <button
          type="button"
          className="schedule-slot-card schedule-slot-card--interactive schedule-slot-card--booked schedule-slot-card--custom"
          style={cardStyle}
          onClick={() => onSelect(slot)}
          data-note={hoverDetails || undefined}
          aria-label={`${typeLabel}, ${customerName || 'khách'}, ${statusLabel}`}
        >
          {content}
        </button>
      ) : (
        <div
          className="schedule-slot-card schedule-slot-card--readonly schedule-slot-card--booked schedule-slot-card--custom"
          style={cardStyle}
          data-note={hoverDetails || undefined}
        >
          {content}
        </div>
      )}
    </td>
  );
}
