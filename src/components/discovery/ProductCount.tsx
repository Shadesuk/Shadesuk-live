export function shadeCountLabel(count: number): string {
  return `${count} ${count === 1 ? "shade" : "shades"}`;
}

type ProductCountProps = {
  count: number;
};

export function ProductCount({ count }: ProductCountProps) {
  const label = shadeCountLabel(count);

  return (
    <p className="text-micro" aria-live="polite" data-product-count={count}>
      {label}
    </p>
  );
}
