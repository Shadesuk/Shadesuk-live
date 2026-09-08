type FilterChipProps = {
  label: string;
  onRemove: () => void;
};

export function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="text-micro">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`}>
        ×
      </button>
    </span>
  );
}
