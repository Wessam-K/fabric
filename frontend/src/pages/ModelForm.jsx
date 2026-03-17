import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Printer, Camera, Layers, FileText, ClipboardList } from 'lucide-react';
import api from '../utils/api';
import ImageUpload from '../components/ImageUpload';
import { useToast } from '../components/Toast';

export default function ModelForm() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = !!code;

  const [serial, setSerial] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [modelName, setModelName] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('unisex');
  const [notes, setNotes] = useState('');
  const [modelImage, setModelImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [bomTemplates, setBomTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (isEdit) {
          const { data } = await api.get(`/models/${code}`);
          setSerial(data.serial_number || '');
          setModelCode(data.model_code || '');
          setModelName(data.model_name || '');
          setCategory(data.category || '');
          setGender(data.gender || 'unisex');
          setNotes(data.notes || '');
          setModelImage(data.model_image || null);
          setBomTemplates(data.bom_templates || []);
        } else {
          const { data } = await api.get('/models/next-serial');
          setSerial(data.next_serial);
        }
      } catch (err) {
        toast.error('فشل تحميل البيانات: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [code, isEdit]);

  const handleSave = async () => {
    if (!serial.trim() || !modelCode.trim()) {
      toast.error('الرقم التسلسلي وكود الموديل مطلوبان');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        serial_number: serial.trim(),
        model_code: modelCode.trim(),
        model_name: modelName.trim() || null,
        category: category.trim() || null,
        gender,
        notes: notes.trim() || null,
      };

      let savedCode;
      if (isEdit) {
        await api.put(`/models/${code}`, payload);
        savedCode = code;
        toast.success('تم تحديث الموديل بنجاح');
      } else {
        const { data } = await api.post('/models', payload);
        savedCode = data.model_code;
        toast.success('تم إنشاء الموديل بنجاح');
      }

      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await api.post(`/models/${savedCode}/image`, fd);
      }

      navigate(`/models/${savedCode}/edit`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">{isEdit ? 'تعديل الموديل' : 'موديل جديد'}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{isEdit ? `كود: ${code}` : 'إضافة موديل جديد للكتالوج'}</p>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <>
              <button onClick={() => navigate(`/models/${code}/bom`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm text-indigo-700 transition-colors">
                <ClipboardList size={16} /> قوائم المواد ({bomTemplates.length})
              </button>
              <button onClick={() => window.open(`/models/${code}/print`, '_blank')}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">
                <Printer size={16} /> طباعة
              </button>
            </>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
            <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Image */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center justify-center">
          <ImageUpload size="lg"
            value={modelImage}
            onChange={(file) => {
              setImageFile(file);
              if (file) setModelImage(URL.createObjectURL(file));
            }} />
          <p className="text-[10px] text-gray-400 mt-2">صورة الموديل</p>
        </div>

        {/* Basic Info */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2"><Layers size={16} /> بيانات الموديل</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">الرقم التسلسلي *</label>
              <input type="text" value={serial} onChange={e => setSerial(e.target.value)} readOnly={isEdit}
                className={`w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all ${isEdit ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder="1-001" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">كود الموديل *</label>
              <input type="text" value={modelCode} onChange={e => setModelCode(e.target.value)} readOnly={isEdit}
                className={`w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all ${isEdit ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder="MDL-001" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">اسم الموديل</label>
              <input type="text" value={modelName} onChange={e => setModelName(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all"
                placeholder="اسم وصفي..." />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">الفئة</label>
              <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all"
                placeholder="قمصان، بنطلون، ..." />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">النوع</label>
              <select value={gender} onChange={e => setGender(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all">
                <option value="unisex">يونيسكس</option>
                <option value="male">رجالي</option>
                <option value="female">حريمي</option>
                <option value="kids">أطفال</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-[11px] text-gray-500 mb-1">ملاحظات</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all resize-none"
              placeholder="ملاحظات اختيارية..." />
          </div>
        </div>
      </div>

      {/* BOM Templates quick view */}
      {isEdit && bomTemplates.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
              <ClipboardList size={16} className="text-indigo-500" /> قوائم المواد (BOM Templates)
            </h3>
            <button onClick={() => navigate(`/models/${code}/bom`)}
              className="text-xs text-[#c9a84c] hover:text-[#a88a3a]">عرض الكل ←</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bomTemplates.map(t => (
              <div key={t.id} className={`p-3 rounded-xl border ${t.is_default ? 'border-[#c9a84c] bg-amber-50/50' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-[#1a1a2e]">{t.template_name}</span>
                  {t.is_default ? <span className="text-[10px] bg-[#c9a84c]/20 text-[#c9a84c] px-2 py-0.5 rounded-full">افتراضي</span> : null}
                </div>
                <p className="text-xs text-gray-400">
                  {t.fabrics_count || 0} أقمشة • {t.accessories_count || 0} اكسسوار • {t.sizes_count || 0} ألوان
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom hint */}
      {isEdit && bomTemplates.length === 0 && (
        <div className="mt-6 bg-indigo-50 rounded-2xl p-5 text-center">
          <p className="text-sm text-indigo-600">لم يتم إضافة قوائم مواد بعد.</p>
          <button onClick={() => navigate(`/models/${code}/bom`)}
            className="mt-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-colors">
            إضافة قائمة مواد
          </button>
        </div>
      )}
    </div>
  );
}
