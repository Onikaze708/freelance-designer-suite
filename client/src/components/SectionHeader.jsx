export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="panel flex flex-col gap-4 p-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-coral">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}