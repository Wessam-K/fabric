import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, ChevronDown, ChevronLeft, Lightbulb, AlertTriangle, CheckCircle, Zap, ArrowLeft, Info, Keyboard, LayoutDashboard, Factory, Scissors, Package, FileText, Settings, Users, BarChart2, Truck, ShoppingCart, Wrench, Clock, DollarSign, Gem, Warehouse, Shield, Bell, Calculator, Calendar, Layers, Send, CheckSquare, Beaker, RotateCcw } from 'lucide-react';
import helpContentFull from '../utils/helpContentFull';

const CATEGORY_MAP = {
  general: { label: 'عام', icon: LayoutDashboard, pages: ['dashboard', 'notifications', 'profile'] },
  production: { label: 'الإنتاج', icon: Factory, pages: ['models', 'modelform', 'workorders', 'workorderform', 'workorderdetail', 'bomtemplates', 'machines', 'maintenance', 'stagetemplates', 'scheduling', 'quality'] },
  sales: { label: 'المبيعات', icon: FileText, pages: ['quotations', 'salesorders', 'samples', 'customers', 'invoices', 'invoiceview'] },
  inventory: { label: 'المخزون', icon: Warehouse, pages: ['fabrics', 'accessories', 'inventory', 'mrp'] },
  finance: { label: 'المالية', icon: DollarSign, pages: ['purchaseorders', 'suppliers', 'expenses', 'chartofaccounts', 'journalentries', 'trialbalance', 'accounting'] },
  shipping: { label: 'الشحن', icon: Send, pages: ['shipping', 'returns'] },
  hr: { label: 'الموارد البشرية', icon: Users, pages: ['employees', 'attendance', 'payroll', 'leaves', 'hr'] },
  admin: { label: 'الإدارة', icon: Shield, pages: ['users', 'permissions', 'auditlog', 'settings', 'documents', 'backups'] },
  reports: { label: 'التقارير', icon: BarChart2, pages: ['reports'] },
};

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPage, setSelectedPage] = useState(null);
  const [expandedCat, setExpandedCat] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);

  // Search across all help content
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return null;
    const q = searchQuery.toLowerCase();
    const results = [];

    Object.entries(helpContentFull).forEach(([key, content]) => {
      let matches = [];

      if (content.pageTitle?.toLowerCase().includes(q)) matches.push({ type: 'title', text: content.pageTitle });
      if (content.overview?.toLowerCase().includes(q)) matches.push({ type: 'overview', text: content.overview.slice(0, 150) + '...' });

      content.features?.forEach(f => {
        if (f.title?.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q))
          matches.push({ type: 'feature', text: f.title + ': ' + f.description });
      });
      content.commonTasks?.forEach(t => {
        if (t.title?.toLowerCase().includes(q) || t.steps?.some(s => s.toLowerCase().includes(q)))
          matches.push({ type: 'task', text: t.title });
      });
      content.tips?.forEach(t => {
        if (t.toLowerCase().includes(q))
          matches.push({ type: 'tip', text: t });
      });
      content.troubleshooting?.forEach(t => {
        if (t.issue?.toLowerCase().includes(q) || t.solution?.toLowerCase().includes(q))
          matches.push({ type: 'troubleshoot', text: t.issue });
      });

      if (matches.length > 0) {
        results.push({ key, title: content.pageTitle, matches });
      }
    });

    return results;
  }, [searchQuery]);

  const content = selectedPage ? helpContentFull[selectedPage] : null;

  return (
    <div className="p-4 lg:p-6 max-w-[1200px] mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#c9a84c]/15 flex items-center justify-center">
            <BookOpen size={20} className="text-[#c9a84c]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">قاعدة المعرفة</h1>
            <p className="text-sm text-gray-500">دليل شامل لجميع صفحات ومميزات النظام</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4 max-w-lg">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSelectedPage(null); }}
            placeholder="ابحث في قاعدة المعرفة... (مثال: فاتورة، قماش، مصنعية)"
            className="w-full border-2 border-gray-200 rounded-xl pr-11 pl-4 py-3 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all"
          />
        </div>
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-500 mb-3">
            نتائج البحث عن &quot;{searchQuery}&quot; ({searchResults.reduce((s, r) => s + r.matches.length, 0)} نتيجة)
          </h2>
          {searchResults.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Search size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">لا توجد نتائج مطابقة</p>
              <p className="text-xs mt-1 text-gray-300">جرّب كلمات بحث مختلفة</p>
            </div>
          )}
          <div className="space-y-2">
            {searchResults.map(result => (
              <button key={result.key} onClick={() => { setSelectedPage(result.key); setSearchQuery(''); }}
                className="w-full text-right bg-white border border-gray-100 rounded-xl p-4 hover:border-[#c9a84c]/30 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#1a1a2e]">{result.title}</h3>
                  <ChevronLeft size={16} className="text-gray-400" />
                </div>
                <div className="mt-2 space-y-1">
                  {result.matches.slice(0, 3).map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        m.type === 'feature' ? 'bg-blue-50 text-blue-600' :
                        m.type === 'task' ? 'bg-green-50 text-green-600' :
                        m.type === 'tip' ? 'bg-amber-50 text-amber-600' :
                        m.type === 'troubleshoot' ? 'bg-red-50 text-red-600' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {m.type === 'feature' ? 'ميزة' : m.type === 'task' ? 'مهمة' : m.type === 'tip' ? 'نصيحة' : m.type === 'troubleshoot' ? 'مشكلة' : 'نظرة عامة'}
                      </span>
                      <span className="truncate">{m.text}</span>
                    </div>
                  ))}
                  {result.matches.length > 3 && (
                    <span className="text-[10px] text-gray-400">+{result.matches.length - 3} نتائج أخرى</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Page Detail View */}
      {selectedPage && content && (
        <div className="mb-8">
          <button onClick={() => setSelectedPage(null)} className="flex items-center gap-1.5 text-sm text-[#c9a84c] hover:text-[#a88a3a] mb-4 transition-colors">
            <ArrowLeft size={14} />
            العودة للقائمة
          </button>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Page Header */}
            <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2a2a4e] p-6 text-white">
              <h2 className="text-xl font-bold mb-1">{content.pageTitle}</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{content.overview}</p>
              {content.shortcuts?.length > 0 && (
                <div className="flex items-center gap-3 mt-3">
                  <Keyboard size={14} className="text-gray-400" />
                  {content.shortcuts.map((s, i) => (
                    <span key={i} className="text-xs">
                      <kbd className="bg-white/15 border border-white/20 px-2 py-0.5 rounded font-mono text-[10px]">{s.key}</kbd>
                      <span className="text-gray-400 mr-1.5">{s.description}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 space-y-8">
              {/* Features */}
              {content.features?.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                    <Zap size={15} className="text-blue-500" /> المميزات
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {content.features.map((f, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-3.5 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                        <h4 className="text-sm font-bold text-[#1a1a2e] mb-1">{f.title}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
                        {f.action && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#c9a84c] mt-2">
                            <ArrowLeft size={10} /> {f.action}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Common Tasks */}
              {content.commonTasks?.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                    <CheckCircle size={15} className="text-green-500" /> كيف أفعل...
                  </h3>
                  <div className="space-y-2">
                    {content.commonTasks.map((task, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                        <button onClick={() => setExpandedTask(expandedTask === `${selectedPage}-${i}` ? null : `${selectedPage}-${i}`)}
                          className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-gray-50 transition-colors">
                          <span className="text-sm font-semibold text-[#1a1a2e]">{task.title}</span>
                          <ChevronDown size={14} className={`text-gray-400 transition-transform ${expandedTask === `${selectedPage}-${i}` ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedTask === `${selectedPage}-${i}` && (
                          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                            {task.prerequisites?.length > 0 && (
                              <div className="bg-amber-50 rounded-lg p-2.5 mb-3 text-xs text-amber-700">
                                <strong>المتطلبات: </strong>{task.prerequisites.join('، ')}
                              </div>
                            )}
                            <ol className="space-y-2.5">
                              {task.steps.map((step, si) => (
                                <li key={si} className="flex items-start gap-3 text-sm text-gray-600">
                                  <span className="w-6 h-6 rounded-full bg-[#c9a84c]/15 text-[#c9a84c] flex items-center justify-center text-xs font-bold shrink-0">
                                    {si + 1}
                                  </span>
                                  <span className="leading-relaxed pt-0.5">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Tips */}
              {content.tips?.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                    <Lightbulb size={15} className="text-amber-500" /> نصائح وحيل
                  </h3>
                  <div className="space-y-2">
                    {content.tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-amber-50 rounded-xl p-3.5">
                        <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800 leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Troubleshooting */}
              {content.troubleshooting?.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-red-500" /> حل المشاكل الشائعة
                  </h3>
                  <div className="space-y-3">
                    {content.troubleshooting.map((t, i) => (
                      <div key={i} className="border border-red-100 rounded-xl overflow-hidden">
                        <div className="bg-red-50 px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-red-700">
                            <AlertTriangle size={13} /> المشكلة
                          </div>
                          <p className="text-sm text-red-600 mt-1">{t.issue}</p>
                        </div>
                        <div className="px-4 py-3 bg-green-50">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-green-700">
                            <CheckCircle size={13} /> الحل
                          </div>
                          <p className="text-sm text-green-600 mt-1">{t.solution}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Related Pages */}
              {content.relatedPages?.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                    <Info size={15} className="text-indigo-500" /> صفحات مرتبطة
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {content.relatedPages.map((page, i) => (
                      <button key={i} onClick={() => navigate(page.url)}
                        className="text-right bg-gray-50 rounded-xl p-3 hover:bg-[#c9a84c]/10 hover:border-[#c9a84c]/20 border border-transparent transition-all">
                        <h4 className="text-sm font-bold text-[#1a1a2e]">{page.title}</h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">{page.description}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Grid (default view) */}
      {!selectedPage && !searchResults && (
        <div className="space-y-4">
          {Object.entries(CATEGORY_MAP).map(([catId, cat]) => {
            const CatIcon = cat.icon;
            const catPages = cat.pages.filter(p => helpContentFull[p]);
            if (catPages.length === 0) return null;
            const isOpen = expandedCat === catId;

            return (
              <div key={catId} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button onClick={() => setExpandedCat(isOpen ? null : catId)}
                  className="w-full flex items-center justify-between px-5 py-4 text-right hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center">
                      <CatIcon size={18} className="text-[#c9a84c]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1a1a2e]">{cat.label}</h3>
                      <p className="text-[11px] text-gray-400">{catPages.length} صفحة</p>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="border-t px-5 pb-4 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {catPages.map(pageKey => {
                        const page = helpContentFull[pageKey];
                        return (
                          <button key={pageKey} onClick={() => { setSelectedPage(pageKey); setExpandedTask(null); }}
                            className="text-right bg-gray-50 rounded-xl p-3.5 hover:bg-[#c9a84c]/10 border border-transparent hover:border-[#c9a84c]/20 transition-all">
                            <h4 className="text-sm font-bold text-[#1a1a2e] mb-1">{page.pageTitle}</h4>
                            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{page.overview?.slice(0, 80)}...</p>
                            <div className="flex items-center gap-2 mt-2">
                              {page.features?.length > 0 && <span className="text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">{page.features.length} ميزة</span>}
                              {page.commonTasks?.length > 0 && <span className="text-[9px] bg-green-50 text-green-500 px-1.5 py-0.5 rounded">{page.commonTasks.length} مهمة</span>}
                              {page.tips?.length > 0 && <span className="text-[9px] bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded">{page.tips.length} نصيحة</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Help Section */}
      {!selectedPage && !searchResults && (
        <div className="mt-8 bg-gradient-to-l from-[#1a1a2e] to-[#2a2a4e] rounded-2xl p-6 text-white">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <Keyboard size={16} className="text-[#c9a84c]" /> اختصارات مفيدة
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'Ctrl+K', desc: 'البحث الشامل في النظام' },
              { key: 'ESC', desc: 'إغلاق النوافذ المنبثقة' },
              { key: '?', desc: 'فتح مساعدة الصفحة (من زر المساعدة)' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2.5">
                <kbd className="bg-white/10 border border-white/20 px-2.5 py-1 rounded font-mono text-xs text-[#c9a84c]">{s.key}</kbd>
                <span className="text-xs text-gray-300">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
