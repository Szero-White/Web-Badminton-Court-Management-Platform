import MultiSelectDropdown from '../filters/MultiSelectDropdown';

export default function ScheduleCourtFilterBar({
  options,
  selectedValues,
  onChange,
  triggerLabel,
  visibleCourtCount,
  totalCourtCount,
  slotCount
}) {
  return (
    <div className="schedule-court-filter-bar">
      <div className="schedule-court-filter-summary" aria-label="Phạm vi lịch đang hiển thị">
        <span>{visibleCourtCount} / {totalCourtCount} sân</span>
        {Number.isFinite(slotCount) ? <span>{slotCount} khung giờ</span> : null}
      </div>

      <div className="schedule-court-filter-control">
        <MultiSelectDropdown
          label="Lọc theo sân"
          allLabel="Tất cả sân"
          triggerLabel={triggerLabel}
          options={options}
          selectedValues={selectedValues}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
