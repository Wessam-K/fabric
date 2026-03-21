export function FormSection({ title, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {title && <div className="card-header"><h3 className="text-sm font-bold text-[#1a1a2e]">{title}</h3></div>}
      <div className="card-body">{children}</div>
    </div>
  );
}

export function FormRow({ children, cols = 2 }) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };
  return <div className={`grid ${gridCols[cols] || gridCols[2]} gap-4`}>{children}</div>;
}

export function FormField({ label, required, error, children }) {
  return (
    <div>
      {label && <label className="form-label">{label}{required && <span className="text-red-500 mr-0.5">*</span>}</label>}
      {children}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
