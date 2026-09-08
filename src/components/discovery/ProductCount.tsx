type ProductCountProps = {
  count: number;
};

export function ProductCount({ count }: ProductCountProps) {
  const label = `${count} ${count === 1 ? "shade" : "shades"}`;

  return (
    <p className="text-micro" aria-live="polite" data-product-count={count}>
      {label}
    </p>
  );
}
