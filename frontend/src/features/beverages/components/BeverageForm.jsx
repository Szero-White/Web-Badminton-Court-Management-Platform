const UNIT_OPTIONS = ['chai', 'lon', 'ly', 'hộp'];

export default function BeverageForm({ form, editingId, onChange, onSubmit, onCancel, saving = false }) {
  return (
    <section className="beverage-card" aria-labelledby="beverage-form-title">
      <div className="beverage-section-heading">
        <div>
          <p className="beverage-eyebrow">Danh mục sản phẩm</p>
          <h2 id="beverage-form-title">{editingId ? 'Chỉnh sửa mặt hàng' : 'Thêm mặt hàng'}</h2>
        </div>
        {editingId ? <button type="button" className="btn-secondary" onClick={onCancel}>Hủy chỉnh sửa</button> : null}
      </div>
      <form className="beverage-form-grid" onSubmit={onSubmit}>
        <label>Tên mặt hàng<input value={form.name} onChange={(event) => onChange('name', event.target.value)} required maxLength={120} /></label>
        <label>Giá bán (VND)<input type="number" min="0" step="1000" value={form.price} onChange={(event) => onChange('price', event.target.value)} required /></label>
        <label>Tồn kho<input type="number" min="0" step="1" value={form.stock} onChange={(event) => onChange('stock', event.target.value)} required /></label>
        <label>Đơn vị<select value={form.unit} onChange={(event) => onChange('unit', event.target.value)}>{UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
        <label className="beverage-form-wide">Mô tả<input value={form.description} onChange={(event) => onChange('description', event.target.value)} maxLength={255} placeholder="Mô tả ngắn về sản phẩm" /></label>
        {editingId ? <label className="beverage-form-wide">Ghi chú chỉnh sửa<input value={form.note} onChange={(event) => onChange('note', event.target.value)} maxLength={255} placeholder="Ví dụ: cập nhật giá nhập mới" /></label> : null}
        <div className="beverage-form-actions"><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Thêm mặt hàng'}</button></div>
      </form>
    </section>
  );
}
