import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Joyride, STATUS } from 'react-joyride';
import { useAuth } from '../context/AuthContext';

const TOUR_STEPS = [
  // ─── Welcome ───
  {
    target: '[data-tour="sidebar"]',
    content: 'القائمة الجانبية — تنقل بين جميع أقسام النظام من هنا. اضغط على أي قسم لفتح قائمته الفرعية.',
    disableBeacon: true,
    placement: 'left',
    title: '🏭 مرحباً بك في WK-Factory',
  },
  {
    target: '[data-tour="dashboard"]',
    content: 'لوحة التحكم — نظرة عامة فورية على المصنع: الإيرادات، أوامر الإنتاج النشطة، تنبيهات المخزون، وجودة الإنتاج.',
    placement: 'left',
    title: '📊 لوحة التحكم',
  },

  // ─── Top Bar ───
  {
    target: '[data-tour="search"]',
    content: 'البحث السريع — اضغط Ctrl+K للبحث الفوري في أي قسم: موديلات، أقمشة، أوامر إنتاج، فواتير، والمزيد.',
    placement: 'bottom',
    title: '🔍 البحث السريع',
  },

  // ─── Sidebar Groups ───
  {
    target: '[data-tour="group-production"]',
    content: 'قسم الإنتاج — يشمل أوامر الإنتاج، إنشاء أمر جديد، الموديلات وقوائم المواد (BOM)، الماكينات، الصيانة، والجدولة.',
    placement: 'left',
    title: '🏭 الإنتاج',
  },
  {
    target: '[data-tour="group-inventory"]',
    content: 'قسم المخزون — إدارة الأقمشة والاكسسوارات مع تتبع الكميات والأسعار وتخطيط احتياجات المواد (MRP).',
    placement: 'left',
    title: '📦 المخزون',
  },
  {
    target: '[data-tour="group-finance"]',
    content: 'قسم المالية — إدارة العملاء، الفواتير، أوامر الشراء، الموردين، المحاسبة، والمصروفات.',
    placement: 'left',
    title: '💰 المالية',
  },
  {
    target: '[data-tour="group-hr"]',
    content: 'الموارد البشرية — إدارة الموظفين، تسجيل الحضور والانصراف، حساب الرواتب الشهرية، والإجازات.',
    placement: 'left',
    title: '👥 الموارد البشرية',
  },

  // ─── Reports (standalone) ───
  {
    target: '[data-tour="reports"]',
    content: 'التقارير — تقارير شاملة: إنتاج، تكاليف، أقمشة، هدر، جودة، موارد بشرية. فلتر بالتاريخ والموديل والعميل.',
    placement: 'left',
    title: '📈 التقارير',
  },
  {
    target: '[data-tour="exports"]',
    content: 'مركز التصدير — صدّر أي تقرير بصيغة Excel أو PDF. يتضمن 15+ نوع تقرير جاهز للطباعة.',
    placement: 'left',
    title: '📥 التصدير',
  },

  // ─── Top Bar (end) ───
  {
    target: '[data-tour="notifications"]',
    content: 'الإشعارات — تنبيهات فورية عند: اكتمال أمر إنتاج، موعد تسليم قريب، نفاد مخزون، أو صيانة مطلوبة.',
    placement: 'bottom',
    title: '🔔 الإشعارات',
  },
  {
    target: '[data-tour="help"]',
    content: 'المساعدة — اضغط هنا في أي وقت لإعادة هذا الدليل أو الاطلاع على شرح الصفحة الحالية.',
    placement: 'bottom-end',
    title: '❓ المساعدة',
  },
];

function tourKey(userId) {
  return `wk-tour-skip-${userId || 'anon'}`;
}

export function resetTourForUser(userId) {
  localStorage.removeItem(tourKey(userId));
}

export default function OnboardingTour() {
  const [run, setRun] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const onDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  useEffect(() => {
    if (!user || !onDashboard) return;
    const skipped = localStorage.getItem(tourKey(user.id));
    if (!skipped) {
      const timer = setTimeout(() => setRun(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, onDashboard]);

  const handleCallback = (data) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      if (dontShow && user) {
        localStorage.setItem(tourKey(user.id), '1');
      }
      setRun(false);
    }
  };

  if (!user || !onDashboard) return null;

  // Inject "don't show again" checkbox into last step
  const steps = TOUR_STEPS.map((step, i) => {
    if (i === TOUR_STEPS.length - 1) {
      return {
        ...step,
        content: (
          <div>
            <p>{step.content}</p>
            <label className="flex items-center gap-2 mt-3 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)}
                className="rounded border-gray-300" />
              لا تعرض الجولة مرة أخرى
            </label>
          </div>
        ),
      };
    }
    return step;
  });

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableScrolling={false}
      disableOverlayClose
      spotlightPadding={4}
      callback={handleCallback}
      locale={{
        back: 'السابق',
        close: 'إغلاق',
        last: 'إنهاء الجولة ✓',
        next: 'التالي ←',
        skip: 'تخطي الجولة',
        open: 'اضغط للمتابعة',
      }}
      styles={{
        options: {
          primaryColor: '#c9a84c',
          zIndex: 10000,
          arrowColor: '#fff',
          backgroundColor: '#fff',
          textColor: '#1a1a2e',
          overlayColor: 'rgba(0, 0, 0, 0.55)',
          width: 380,
        },
        tooltip: {
          borderRadius: 12,
          padding: '20px 24px',
          fontSize: '15px',
          lineHeight: '1.8',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          maxWidth: '90vw',
        },
        tooltipTitle: {
          fontSize: '17px',
          fontWeight: 700,
          marginBottom: 8,
          color: '#1a1a2e',
        },
        tooltipContent: {
          fontSize: '14px',
          padding: '8px 0',
        },
        buttonNext: {
          backgroundColor: '#c9a84c',
          color: '#fff',
          borderRadius: 8,
          padding: '8px 20px',
          fontSize: '14px',
          fontWeight: 600,
        },
        buttonBack: {
          color: '#666',
          marginLeft: 8,
          fontSize: '14px',
        },
        buttonSkip: {
          color: '#999',
          fontSize: '13px',
        },
        beacon: {
          display: 'block',
        },
        beaconInner: {
          backgroundColor: '#c9a84c',
          width: 24,
          height: 24,
          borderRadius: '50%',
        },
        beaconOuter: {
          backgroundColor: 'rgba(201, 168, 76, 0.3)',
          borderColor: '#c9a84c',
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '3px solid #c9a84c',
        },
        spotlight: {
          borderRadius: 8,
        },
      }}
      floaterProps={{
        disableAnimation: false,
        offset: 16,
        styles: {
          arrow: { length: 8, spread: 14 },
        },
      }}
    />
  );
}

export function resetTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}
