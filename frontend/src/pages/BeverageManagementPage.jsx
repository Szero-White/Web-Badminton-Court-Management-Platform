import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../services/api';
import BeverageForm from '../features/beverages/components/BeverageForm';
import BeverageHistoryPanel from '../features/beverages/components/BeverageHistoryPanel';
import BeverageInventoryTable from '../features/beverages/components/BeverageInventoryTable';
import './BeverageManagementPage.css';

const EMPTY_FORM = {
  name: '',
  price: '',
  stock: '',
  unit: 'chai',
  description: '',
  note: ''
};

function apiError(error, fallback) {
  return error?.response?.data?.error?.message || fallback;
}

export default function BeverageManagementPage() {
  const [beverages, setBeverages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadBeverages = useCallback(async ({ announce = false } = {}) => {
    setLoading(true);
    try {
      const response = await adminApi.listBeverages();
      setBeverages(response.data?.data || []);
      if (announce) setMessage('Đã cập nhật dữ liệu kho nước uống.');
    } catch (error) {
      setMessage(apiError(error, 'Không thể tải danh sách nước uống.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBeverages();
  }, [loadBeverages]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      price: String(item.price ?? ''),
      stock: String(item.stock ?? ''),
      unit: item.unit || 'chai',
      description: item.description || '',
      note: ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      unit: form.unit,
      description: form.description.trim()
    };

    if (!payload.name || !Number.isFinite(payload.price) || payload.price < 0 || !Number.isInteger(payload.stock) || payload.stock < 0) {
      setMessage('Vui lòng kiểm tra tên, giá bán và số lượng tồn kho.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateBeverage(editingId, { ...payload, note: form.note.trim() });
        setMessage('Cập nhật mặt hàng thành công.');
      } else {
        await adminApi.createBeverage(payload);
        setMessage('Thêm mặt hàng thành công.');
      }
      resetForm();
      await loadBeverages();
    } catch (error) {
      setMessage(apiError(error, editingId ? 'Không thể cập nhật mặt hàng.' : 'Không thể thêm mặt hàng.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Xóa mặt hàng “${item.name}”? Hành động này sẽ được ghi vào lịch sử.`)) return;
    try {
      await adminApi.deleteBeverage(item.id, 'Quản trị viên xóa mặt hàng từ trang quản lý kho');
      if (editingId === item.id) resetForm();
      if (historyItem?.id === item.id) setHistoryItem(null);
      setMessage(`Đã xóa mặt hàng ${item.name}.`);
      await loadBeverages();
    } catch (error) {
      setMessage(apiError(error, 'Không thể xóa mặt hàng.'));
    }
  }

  async function openHistory(item) {
    setHistoryItem(item);
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      const response = await adminApi.beverageHistory(item.id, 30);
      setHistoryRows(response.data?.data || []);
    } catch (error) {
      setMessage(apiError(error, 'Không thể tải lịch sử chỉnh sửa.'));
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <section className="panel beverage-management-page">
      <header className="beverage-page-header">
        <div>
          <p className="beverage-eyebrow">Quản lý kho</p>
          <h1>Nước uống & hàng bán tại quầy</h1>
          <p>Quản lý danh mục, giá bán, tồn kho và lịch sử thay đổi trên một màn hình.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => loadBeverages({ announce: true })} disabled={loading}>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </header>

      {message ? <p className="message beverage-page-message" role="status">{message}</p> : null}

      <BeverageForm
        form={form}
        editingId={editingId}
        onChange={updateField}
        onSubmit={handleSubmit}
        onCancel={resetForm}
        saving={saving}
      />

      <BeverageInventoryTable
        beverages={beverages}
        loading={loading}
        onEdit={startEdit}
        onDelete={handleDelete}
        onHistory={openHistory}
      />

      <BeverageHistoryPanel
        item={historyItem}
        rows={historyRows}
        loading={historyLoading}
        onClose={() => setHistoryItem(null)}
      />
    </section>
  );
}
