export default function ScheduleLegend() {
  return (
    <div className="schedule-legend" aria-label="Chú thích trạng thái lịch sân">
      <span><i className="schedule-legend-dot schedule-legend-dot--available" />Còn trống</span>
      <span><i className="schedule-legend-dot schedule-legend-dot--walkin" />Khách vãng lai</span>
      <span><i className="schedule-legend-dot schedule-legend-dot--monthly" />Khách cố định theo tháng</span>
    </div>
  );
}
