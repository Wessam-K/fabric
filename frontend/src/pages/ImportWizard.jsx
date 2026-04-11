import { useState, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import HelpButton from '../components/HelpButton';

const ENTITY_LABELS = { suppliers: 'الموردين', customers: 'العملاء', fabrics: 'الأقمشة', accessories: 'الاكسسوارات' };

export default function ImportWizard() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [entity, setEntity] = useState('');
  const [templates, setTemplates] = useState([]);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);

  useEffect(() => {
    api.get('/import/templates').then(r => setTemplates(r.data || [])).catch(e => console.error('Import templates failed:', e.message));
  }, []);

  // Poll job progress
  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const { data } = await api.get(`/import/jobs/${jobId}`);
        setJobStatus(data);
        if (data.status === 'completed' || data.status === 'failed') clearInterval(poll);
      } catch { clearInterval(poll); }
    }, 1000);
    return () => clearInterval(poll);
  }, [jobId]);

  const handleUpload = async () => {
    if (!entity || !file) { toast.error('اختر النوع والملف'); return; }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entity', entity);
      const { data } = await api.post('/import/bulk', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.jobId) {
        setJobId(data.jobId);
        setStep(3);
      } else {
        toast.success(`تم الاستيراد: ${data.imported || data.count || 0} سجل`);
        setStep(3);
        setJobStatus({ status: 'completed', imported: data.imported || data.count || 0, errors: data.errors || [] });
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'فشل الاستيراد';
      toast.error(msg);
      setJobStatus({ status: 'failed', error: msg, errors: err.response?.data?.errors || [] });
      setStep(3);
    }
    finally { setImporting(false); }
  };

  const selectedTemplate = templates.find(t => t.entity === entity);

  return (
    <div className="page max-w-2xl mx-auto">
      <PageHeader title="استيراد البيانات" subtitle="استيراد بيانات من ملف Excel أو CSV"
        action={<HelpButton pageKey="import" />} />

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6">
        {[{ n: 1, label: 'اختر النوع' }, { n: 2, label: 'رفع الملف' }, { n: 3, label: 'النتيجة' }].map(s => (
          <div key={s.n} className={`flex-1 text-center py-2 rounded-lg text-sm font-bold ${step === s.n ? 'bg-[#c9a84c] text-[#1a1a2e]' : step > s.n ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {s.label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <div className="card-body space-y-4">
            <h3 className="text-sm font-bold">اختر نوع البيانات للاستيراد</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <button key={k} onClick={() => setEntity(k)}
                  className={`p-4 rounded-xl border-2 text-sm font-semibold transition-colors ${entity === k ? 'border-[#c9a84c] bg-[#c9a84c]/10' : 'border-gray-200 hover:border-gray-300'}`}>
                  <FileSpreadsheet size={24} className="mx-auto mb-2 text-gray-400" />
                  {v}
                </button>
              ))}
            </div>
            {selectedTemplate && (
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-bold mb-1">الحقول المطلوبة:</p>
                <p>{(selectedTemplate.required_fields || selectedTemplate.fields || []).join(', ')}</p>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => entity && setStep(2)} disabled={!entity}
                className="btn btn-gold disabled:opacity-50">التالي</button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="card-body space-y-4">
            <h3 className="text-sm font-bold">رفع ملف {ENTITY_LABELS[entity]}</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#c9a84c] transition-colors"
              onClick={() => fileRef.current?.click()}>
              <Upload size={40} className="mx-auto mb-3 text-gray-300" />
              {file ? (
                <p className="text-sm font-semibold text-[#1a1a2e]">{file.name}</p>
              ) : (
                <p className="text-sm text-gray-400">اضغط لاختيار ملف Excel (.xlsx) أو CSV</p>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="btn btn-outline">السابق</button>
              <button onClick={handleUpload} disabled={!file || importing}
                className="btn btn-gold disabled:opacity-50 flex items-center gap-2">
                {importing && <Loader2 size={16} className="animate-spin" />}
                {importing ? 'جاري الاستيراد...' : 'استيراد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && jobStatus && (
        <div className="card">
          <div className="card-body space-y-4 text-center">
            {jobStatus.status === 'completed' ? (
              <>
                <CheckCircle size={48} className="mx-auto text-green-500" />
                <h3 className="text-lg font-bold text-green-700">تم الاستيراد بنجاح</h3>
                <p className="text-sm text-gray-600">تم استيراد {jobStatus.imported || 0} سجل</p>
              </>
            ) : jobStatus.status === 'failed' ? (
              <>
                <AlertCircle size={48} className="mx-auto text-red-500" />
                <h3 className="text-lg font-bold text-red-700">فشل الاستيراد</h3>
                <p className="text-sm text-gray-600">{jobStatus.error || 'حدث خطأ'}</p>
              </>
            ) : (
              <>
                <Loader2 size={48} className="mx-auto text-[#c9a84c] animate-spin" />
                <h3 className="text-lg font-bold">جاري المعالجة...</h3>
                <p className="text-sm text-gray-500">{jobStatus.processed || 0} / {jobStatus.total || '?'}</p>
              </>
            )}
            {jobStatus.errors?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 text-right max-h-40 overflow-y-auto">
                <p className="text-xs font-bold text-red-700 mb-1">أخطاء ({jobStatus.errors.length}):</p>
                {jobStatus.errors.slice(0, 20).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{typeof e === 'string' ? e : (e.message || e.error || JSON.stringify(e))}</p>
                ))}
              </div>
            )}
            <button onClick={() => { setStep(1); setEntity(''); setFile(null); setJobId(null); setJobStatus(null); }}
              className="btn btn-gold">استيراد آخر</button>
          </div>
        </div>
      )}
    </div>
  );
}
