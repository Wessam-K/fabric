import { useState, useRef, useEffect } from 'react';

/**
 * Contextual Tooltip component
 * Wraps any element and shows a tooltip on hover.
 *
 * Usage: <Tooltip text="شرح الحقل"><input ... /></Tooltip>
 */
export default function Tooltip({ children, text, position = 'top', delay = 300 }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const tooltipRef = useRef(null);

  const show = () => { timerRef.current = setTimeout(() => setVisible(true), delay); };
  const hide = () => { clearTimeout(timerRef.current); setVisible(false); };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!text) return children;

  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'right-full top-1/2 -translate-y-1/2 mr-2',
    left: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <div ref={tooltipRef}
          role="tooltip"
          className={`absolute z-50 ${posClasses[position]} px-2.5 py-1.5 bg-[#1a1a2e] text-white text-[11px] rounded-lg whitespace-nowrap shadow-lg max-w-[200px] text-center leading-relaxed pointer-events-none animate-[fadeIn_0.15s_ease]`}
          dir="rtl">
          {text}
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
