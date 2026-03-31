import { useState, useEffect, useRef } from 'react';
import { HelpCircle, X, ChevronDown, ChevronLeft, Search, BookOpen, Lightbulb, AlertTriangle, ArrowLeft, Zap, Link2, Keyboard, CheckCircle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import helpContentAr from '../utils/helpContentFull';
import helpContentEn from '../utils/helpContentFull_en';

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: Info },
  { id: 'features', label: 'المميزات', icon: Zap },
  { id: 'tasks', label: 'كيف أفعل...', icon: CheckCircle },
  { id: 'tips', label: 'نصائح', icon: Lightbulb },
  { id: 'troubleshoot', label: 'حل المشاكل', icon: AlertTriangle },
  { id: 'related', label: 'صفحات مرتبطة', icon: Link2 },
];

export default function HelpButton({ pageKey }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedTask, setExpandedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const helpContentFull = i18n.language === 'en' ? helpContentEn : helpContentAr;
  const content = helpContentFull[pageKey];

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Reset state on open
  useEffect(() => {
    if (open) { setActiveTab('overview'); setExpandedTask(null); setSearchQuery(''); }
  }, [open]);

  if (!content) return null;

  // Filter content by search
  const matchSearch = (text) => !searchQuery || text?.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredFeatures = content.features?.filter(f => matchSearch(f.title) || matchSearch(f.description)) || [];
  const filteredTasks = content.commonTasks?.filter(t => matchSearch(t.title) || t.steps?.some(s => matchSearch(s))) || [];
  const filteredTips = content.tips?.filter(t => matchSearch(t)) || [];
  const filteredTrouble = content.troubleshooting?.filter(t => matchSearch(t.issue) || matchSearch(t.solution)) || [];
  const filteredRelated = content.relatedPages?.filter(p => matchSearch(p.title) || matchSearch(p.description)) || [];
  const filteredShortcuts = content.shortcuts?.filter(s => matchSearch(s.key) || matchSearch(s.description)) || [];

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#c9a84c] hover:bg-yellow-50 dark:hover:bg-white/10 transition-colors"
        title="مساعدة هذه الصفحة"
        aria-label="مساعدة">
        <HelpCircle size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)}>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" />

          {/* Slide-in Panel */}
          <div ref={panelRef} dir="rtl"
            className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white dark:bg-[#1a1a2e] shadow-2xl animate-[slideInRight_0.25s_ease] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Panel Header */}
            <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2a2a4e] px-5 py-4 text-white shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-[#c9a84c]" />
                  <h3 className="font-bold text-base">{content.pageTitle}</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10" aria-label="إغلاق">
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{content.overview?.slice(0, 120)}...</p>

              {/* Search */}
              <div className="mt-3 relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث في المساعدة..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder:text-gray-400 outline-none focus:border-[#c9a84c] transition-colors" />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-3 py-2 bg-gray-50 dark:bg-white/5 border-b dark:border-white/8 overflow-x-auto shrink-0 no-scrollbar">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-colors ${
                      activeTab === tab.id ? 'bg-[#c9a84c]/15 text-[#c9a84c] font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}>
                    <Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{content.overview}</p>

                  {filteredShortcuts.length > 0 && (
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                        <Keyboard size={13} /> اختصارات لوحة المفاتيح
                      </h4>
                      <div className="space-y-1.5">
                        {filteredShortcuts.map((s, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">{s.description}</span>
                            <kbd className="bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded font-mono text-[10px]">{s.key}</kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                      <div className="text-lg font-bold text-blue-600">{content.features?.length || 0}</div>
                      <div className="text-[10px] text-blue-500">مميزات</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2.5 text-center">
                      <div className="text-lg font-bold text-green-600">{content.commonTasks?.length || 0}</div>
                      <div className="text-[10px] text-green-500">مهام</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                      <div className="text-lg font-bold text-amber-600">{content.tips?.length || 0}</div>
                      <div className="text-[10px] text-amber-500">نصائح</div>
                    </div>
                  </div>
                </>
              )}

              {/* FEATURES TAB */}
              {activeTab === 'features' && (
                <div className="space-y-3">
                  {filteredFeatures.length === 0 && <EmptyState text="لا توجد مميزات مطابقة" />}
                  {filteredFeatures.map((f, i) => (
                    <div key={i} className="border border-gray-100 dark:border-white/10 rounded-xl p-3 hover:border-[#c9a84c]/30 hover:bg-[#c9a84c]/5 transition-colors">
                      <h4 className="text-sm font-bold text-[#1a1a2e] dark:text-white mb-1">{f.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-2">{f.description}</p>
                      {f.action && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#c9a84c]">
                          <ArrowLeft size={11} />
                          <span>{f.action}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TASKS TAB */}
              {activeTab === 'tasks' && (
                <div className="space-y-2">
                  {filteredTasks.length === 0 && <EmptyState text="لا توجد مهام مطابقة" />}
                  {filteredTasks.map((task, i) => (
                    <div key={i} className="border border-gray-100 dark:border-white/10 rounded-xl overflow-hidden">
                      <button onClick={() => setExpandedTask(expandedTask === i ? null : i)}
                        className="w-full flex items-center justify-between px-3.5 py-3 text-right hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <span className="text-sm font-semibold text-[#1a1a2e] dark:text-white">{task.title}</span>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${expandedTask === i ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedTask === i && (
                        <div className="px-3.5 pb-3 border-t border-gray-100 dark:border-white/10 pt-3">
                          {task.prerequisites?.length > 0 && (
                            <div className="bg-amber-50 rounded-lg p-2.5 mb-3 text-xs text-amber-700">
                              <strong>المتطلبات: </strong>{task.prerequisites.join('، ')}
                            </div>
                          )}
                          <ol className="space-y-2">
                            {task.steps.map((step, si) => (
                              <li key={si} className="flex items-start gap-2.5 text-xs text-gray-600 dark:text-gray-400">
                                <span className="w-5 h-5 rounded-full bg-[#c9a84c]/15 text-[#c9a84c] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                  {si + 1}
                                </span>
                                <span className="leading-relaxed">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TIPS TAB */}
              {activeTab === 'tips' && (
                <div className="space-y-2.5">
                  {filteredTips.length === 0 && <EmptyState text="لا توجد نصائح مطابقة" />}
                  {filteredTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                      <Lightbulb size={14} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{tip}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* TROUBLESHOOT TAB */}
              {activeTab === 'troubleshoot' && (
                <div className="space-y-3">
                  {filteredTrouble.length === 0 && <EmptyState text="لا توجد مشاكل شائعة مسجلة لهذه الصفحة" />}
                  {filteredTrouble.map((t, i) => (
                    <div key={i} className="border border-red-100 rounded-xl overflow-hidden">
                      <div className="bg-red-50 px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                          <AlertTriangle size={12} /> المشكلة
                        </div>
                        <p className="text-xs text-red-600 mt-1">{t.issue}</p>
                      </div>
                      <div className="px-3.5 py-2.5 bg-green-50">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-green-700">
                          <CheckCircle size={12} /> الحل
                        </div>
                        <p className="text-xs text-green-600 mt-1">{t.solution}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* RELATED TAB */}
              {activeTab === 'related' && (
                <div className="space-y-2">
                  {filteredRelated.length === 0 && <EmptyState text="لا توجد صفحات مرتبطة" />}
                  {filteredRelated.map((page, i) => (
                    <button key={i} onClick={() => { navigate(page.url); setOpen(false); }}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-white/10 hover:border-[#c9a84c]/30 hover:bg-[#c9a84c]/5 transition-colors text-right">
                      <div>
                        <h4 className="text-sm font-bold text-[#1a1a2e] dark:text-white">{page.title}</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{page.description}</p>
                      </div>
                      <ChevronLeft size={14} className="text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-3 border-t dark:border-white/8 bg-gray-50 dark:bg-white/5 text-center">
              <button onClick={() => { navigate('/knowledge-base'); setOpen(false); }}
                className="text-xs text-[#c9a84c] hover:text-[#a88a3a] font-bold flex items-center gap-1.5 justify-center mx-auto transition-colors">
                <BookOpen size={13} />
                فتح قاعدة المعرفة الكاملة
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-8 text-gray-400">
      <Info size={24} className="mx-auto mb-2 opacity-50" />
      <p className="text-xs">{text}</p>
    </div>
  );
}
