export default function TransactionForms({
  saleForm,
  setSaleForm,
  refundForm,
  setRefundForm,
  ownerWithdrawForm,
  setOwnerWithdrawForm,
  onSaleSubmit,
  onRefundSubmit,
  onOwnerWithdrawSubmit
}) {
  return (
    <div className="transaction-forms">
      <section className="form-card">
        <h2>📦 Ghi nhận bán hàng</h2>
        <form onSubmit={onSaleSubmit}>
          <div className="form-group">
            <label>Nội dung bán *</label>
            <input
              type="text"
              placeholder="VD: 5 chai nước suối, 2 lon trà ô long"
              value={saleForm.description}
              onChange={(event) => setSaleForm({ ...saleForm, description: event.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Số tiền (₫) *</label>
            <input
              type="number"
              placeholder="VD: 50000"
              value={saleForm.amount}
              onChange={(event) => setSaleForm({ ...saleForm, amount: event.target.value })}
              required
              min="1000"
              step="1000"
            />
          </div>
          <div className="form-group">
            <label>Phương thức thanh toán *</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="cash"
                  checked={saleForm.paymentMethod === 'cash'}
                  onChange={(event) => setSaleForm({ ...saleForm, paymentMethod: event.target.value })}
                />
                💵 Tiền mặt
              </label>
              <label>
                <input
                  type="radio"
                  value="transfer"
                  checked={saleForm.paymentMethod === 'transfer'}
                  onChange={(event) => setSaleForm({ ...saleForm, paymentMethod: event.target.value })}
                />
                💳 Chuyển khoản
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>Ghi chú</label>
            <textarea
              placeholder="Ghi chú thêm..."
              value={saleForm.notes}
              onChange={(event) => setSaleForm({ ...saleForm, notes: event.target.value })}
              rows="2"
            />
          </div>
          <button type="submit" className="btn btn-primary">Lưu giao dịch bán</button>
        </form>
      </section>

      <section className="form-card">
        <h2>↩️ Ghi nhận hoàn tiền</h2>
        <form onSubmit={onRefundSubmit}>
          <div className="form-group">
            <label>Lý do *</label>
            <select
              value={refundForm.description}
              onChange={(event) => setRefundForm({ ...refundForm, description: event.target.value })}
              required
            >
              <option value="">-- Chọn lý do --</option>
              <option value="wrong_entry">❌ Nhập nhầm</option>
              <option value="customer_return">🔄 Khách trả lại nước</option>
              <option value="booking_cancel">📅 Hủy lịch đặt sân</option>
              <option value="damaged">💔 Hàng hỏng/lỗi</option>
              <option value="adjustment">⚙️ Điều chỉnh</option>
              <option value="other">📝 Khác</option>
            </select>
          </div>
          <div className="form-group">
            <label>Số tiền hoàn (₫) *</label>
            <input
              type="number"
              placeholder="VD: 25000"
              value={refundForm.amount}
              onChange={(event) => setRefundForm({ ...refundForm, amount: event.target.value })}
              required
              min="1000"
              step="1000"
            />
          </div>
          <div className="form-group">
            <label>Ghi chú nhân viên</label>
            <textarea
              placeholder="Lý do chi tiết của hoàn tiền..."
              value={refundForm.notes}
              onChange={(event) => setRefundForm({ ...refundForm, notes: event.target.value })}
              rows="2"
            />
          </div>
          <button type="submit" className="btn btn-warning">Lưu hoàn tiền</button>
        </form>
      </section>

      <section className="form-card">
        <h2>🏦 Chủ rút tiền mặt</h2>
        <form onSubmit={onOwnerWithdrawSubmit}>
          <div className="form-group">
            <label>Số tiền chủ rút (₫) *</label>
            <input
              type="number"
              placeholder="VD: 200000"
              value={ownerWithdrawForm.amount}
              onChange={(event) => setOwnerWithdrawForm({ ...ownerWithdrawForm, amount: event.target.value })}
              required
              min="1000"
              step="1000"
            />
          </div>
          <div className="form-group">
            <label>Ghi chú</label>
            <textarea
              placeholder="VD: Chủ rút tiền cuối ca"
              value={ownerWithdrawForm.notes}
              onChange={(event) => setOwnerWithdrawForm({ ...ownerWithdrawForm, notes: event.target.value })}
              rows="2"
            />
          </div>
          <button type="submit" className="btn btn-primary">Lưu tiền chủ rút</button>
        </form>
      </section>
    </div>
  );
}
