import { useEffect, useMemo, useState } from 'react';
import ScheduleCourtFilterBar from '../../../components/schedule/ScheduleCourtFilterBar';
import ScheduleDateNavigator from '../../../components/schedule/ScheduleDateNavigator';
import ScheduleSlotCell from '../../../components/schedule/ScheduleSlotCell';
import { formatTime } from '../../../utils/dateTime';

function bookingRangeText(group) {
  if (!group) return '';
  return `${formatTime(group.start_time)} - ${formatTime(group.end_time)}`;
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
  const [selectedCourtIds, setSelectedCourtIds] = useState([]);

  useEffect(() => {
    setSelectedCourtIds((current) => current.filter((courtId) => courtColumns.some((court) => String(court.courtId) === String(courtId))));
  }, [courtColumns]);

  const visibleIndexes = useMemo(() => {
    if (selectedCourtIds.length === 0) return courtColumns.map((_, index) => index);
    const selected = new Set(selectedCourtIds.map(String));
    return courtColumns
      .map((court, index) => ({ court, index }))
      .filter(({ court }) => selected.has(String(court.courtId)))
      .map(({ index }) => index);
  }, [courtColumns, selectedCourtIds]);

  const visibleCourts = useMemo(() => visibleIndexes.map((index) => courtColumns[index]), [courtColumns, visibleIndexes]);
  const visibleGrid = useMemo(
    () => heatmapGrid.map((row) => ({ ...row, cells: visibleIndexes.map((index) => row.cells[index]) })),
    [heatmapGrid, visibleIndexes]
  );
  const courtFilterOptions = useMemo(
    () => courtColumns.map((court) => ({ value: String(court.courtId), label: court.courtName, description: `Sân ${court.courtId}` })),
    [courtColumns]
  );
  const courtSummary = selectedCourtIds.length === 0
    ? 'Tất cả sân'
    : selectedCourtIds.length === 1
      ? visibleCourts[0]?.courtName || '1 sân đã chọn'
      : `${selectedCourtIds.length} sân đã chọn`;

  return (
    <article className="staff-action-card staff-booking-board">
      <ScheduleDateNavigator
        value={viewDay}
        onChange={setViewDay}
        eyebrow="Lịch theo ngày"
        title="Bảng sân theo giờ"
        description="Bấm ô trống để đặt sân cho khách; bấm ô đã đặt để xem và xử lý booking."
      >
        <ScheduleCourtFilterBar
          options={courtFilterOptions}
          selectedValues={selectedCourtIds}
          onChange={setSelectedCourtIds}
          triggerLabel={courtSummary}
          visibleCourtCount={visibleCourts.length}
          totalCourtCount={courtColumns.length}
          slotCount={heatmapGrid.length}
        />
      </ScheduleDateNavigator>


      <div className="heatmap-wrapper staff-heatmap-wrap">
        <table className="heatmap staff-heatmap-table">
          <thead>
            <tr>
              <th className="time-header">Giờ</th>
              {visibleCourts.map((court) => (
                <th key={court.courtId} className="court-header">
                  <div className="court-header-content">
                    <strong>{court.courtName}</strong>
                    <small>Sân {court.courtId}</small>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleGrid.map(({ time, label, cells }) => (
              <tr key={time} className="heatmap-row">
                <td className="time-cell">{label}</td>
                {cells.map((slot, index) => {
                  if (!slot) {
                    return <ScheduleSlotCell key={`${time}-${index}`} slot={null} />;
                  }

                  const groupInfo = groupInfoBySlotId?.get?.(String(slot.id));
                  const group = bookingGroups.find((item) => item.groupKey === groupInfo?.groupKey);
                  return (
                    <ScheduleSlotCell
                      key={slot.id || `${time}-${index}`}
                      slot={slot}
                      mode="manage"
                      selected={selectedBookingSlotIds.has(String(slot.id))}
                      onSelect={onCellClick}
                      slotCount={groupInfo?.slotCount || 1}
                      rangeText={bookingRangeText(group)}
                      note={group?.booking_note?.trim() || ''}
                      bookingGroup={group}
                    />
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
