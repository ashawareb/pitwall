interface MetaRowProps {
  label: string;
  value: string;
}

export default function MetaRow({ label, value }: MetaRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-meta uppercase tracking-meta text-pw-fg-faint">
        {label}
      </span>
      <span className="font-mono text-ui text-pw-fg-primary">{value}</span>
    </div>
  );
}
