export default function PageHeader({ title, subtitle, children, action, actions }) {
  const act = children || action || actions;
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {act && <div className="flex items-center gap-2">{act}</div>}
    </div>
  );
}
