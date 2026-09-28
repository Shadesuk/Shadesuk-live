export const PRODUCT_DISCLOSURE_COPY = "High-quality 1:1 Superclone";

export function productDisclosureCopy(disclosure?: string | null): string {
  const trimmed = disclosure?.trim();
  return trimmed || PRODUCT_DISCLOSURE_COPY;
}

type ProductDisclosureProps = {
  disclosure?: string | null;
};

export function ProductDisclosure({ disclosure }: ProductDisclosureProps) {
  return (
    <p className="text-micro" data-product-disclosure>
      {productDisclosureCopy(disclosure)}
    </p>
  );
}
