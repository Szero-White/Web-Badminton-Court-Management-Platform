import { BOOKING_COLOR_PALETTE, DEFAULT_BOOKING_COLOR } from '../../utils/bookingForm';

export default function BookingColorPicker({ value, onChange, disabled = false }) {
  const selected = value || DEFAULT_BOOKING_COLOR;

  return (
    <div className="booking-color-picker">
      <div className="booking-color-palette" role="list" aria-label="Màu booking gợi ý">
        {BOOKING_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={`booking-color-swatch ${selected.toLowerCase() === color.toLowerCase() ? 'is-selected' : ''}`}
            style={{ '--booking-swatch': color }}
            aria-label={`Chọn màu ${color}`}
            aria-pressed={selected.toLowerCase() === color.toLowerCase()}
            onClick={() => onChange(color)}
            disabled={disabled}
          />
        ))}
      </div>
      <label className="booking-color-custom">
        <span>Màu tùy chỉnh</span>
        <input
          type="color"
          value={selected}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
        <code>{selected.toUpperCase()}</code>
      </label>
    </div>
  );
}
