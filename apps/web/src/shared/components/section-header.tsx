export function SectionHeader({
  title,
  label,
  action,
  badge,
}: {
  title: string;
  label?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-fx-text">{label ?? title}</h2>
        {badge}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;
