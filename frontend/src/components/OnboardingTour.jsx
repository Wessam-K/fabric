import { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';

const TOUR_STEPS = [
  {
    target: '[data-tour="sidebar"]',
    content: 'القائمة الجانبية — تنقل بين جميع أقسام النظام من هنا',
    disableBeacon: true,
    placement: 'right',
  },
  {
    target: '[data-tour="dashboard"]',
    content: 'لوحة التحكم — نظرة عامة على المصنع والإحصائيات',
    placement: 'bottom',
  },
  {
    target: '[data-tour="workorders"]',
    content: 'أوامر الإنتاج — إدارة وتتبع جميع أوامر العمل والمراحل',
    placement: 'right',
  },
  {
    target: '[data-tour="search"]',
    content: 'البحث السريع — ابحث في أي قسم فوراً باستخدام Ctrl+K',
    placement: 'bottom',
  },
  {
    target: '[data-tour="notifications"]',
    content: 'الإشعارات — تنبيهات فورية للأحداث المهمة',
    placement: 'bottom',
  },
  {
    target: '[data-tour="help"]',
    content: 'المساعدة — دليل استخدام مفصل لكل صفحة',
    placement: 'left',
  },
];

const TOUR_STORAGE_KEY = 'wk-tour-completed';

export default function OnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      // Start tour after a short delay to let DOM render
      const timer = setTimeout(() => setRun(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCallback = (data) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      setRun(false);
    }
  };

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleCallback}
      locale={{
        back: 'السابق',
        close: 'إغلاق',
        last: 'إنهاء',
        next: 'التالي',
        skip: 'تخطي',
      }}
      styles={{
        options: {
          primaryColor: '#3b82f6',
          zIndex: 10000,
        },
      }}
    />
  );
}

export function resetTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}
