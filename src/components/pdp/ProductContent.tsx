import Link from "next/link";
import type { ReactNode } from "react";
import type { MappedStorefrontProduct } from "@/contracts";
import { routes } from "@/lib/navigation";
import type { ProductColour } from "@/types/catalogue";
import { shapeLabel } from "./face-guide";
import styles from "./ProductContent.module.css";

type ProductContentProps = {
  product: MappedStorefrontProduct;
  colour?: ProductColour;
};

export function ProductContent({ product, colour }: ProductContentProps) {
  const details = detailItems(product, colour);
  const included = product.pdp?.whatsIncluded;

  return (
    <div className={styles.list}>
      {product.description ? (
        <Accordion title="Description">
          <p className="text-body">{product.description}</p>
        </Accordion>
      ) : null}
      {details.length > 0 ? (
        <Accordion title="Details">
          <ul className="text-small">
            {details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Accordion>
      ) : null}
      {included ? (
        <Accordion title="What's included">
          <p className="text-small">{included}</p>
        </Accordion>
      ) : null}
      <Accordion title="Shipping">
        <p className="text-small">
          International shipping. Delivery is expected to take a minimum of 2
          weeks. Transit times vary. Tracking appears once a shipment has been
          dispatched.
        </p>
        <p className="text-small">
          <Link href={routes.shipping}>Shipping policy</Link>
        </p>
      </Accordion>
      <Accordion title="Returns / Refunds">
        <p className="text-small">
          <Link href={routes.refunds}>Returns / Refunds policy</Link>
        </p>
      </Accordion>
    </div>
  );
}

function Accordion({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.item}>
      <summary className="text-micro">{title}</summary>
      <div className={styles.panel}>{children}</div>
    </details>
  );
}

function detailItems(
  product: MappedStorefrontProduct,
  colour?: ProductColour,
): string[] {
  const items: string[] = [];
  if (product.shape.length > 0) {
    items.push(`Frame shape — ${product.shape.map(shapeLabel).join(", ")}`);
  }
  const measurements = product.measurements;
  if (measurements?.lensMm != null) {
    items.push(`Lens width — ${measurements.lensMm} mm`);
  }
  if (measurements?.bridgeMm != null) {
    items.push(`Bridge width — ${measurements.bridgeMm} mm`);
  }
  if (measurements?.templeMm != null) {
    items.push(`Temple length — ${measurements.templeMm} mm`);
  }
  if (product.pdp?.materials) {
    items.push(`Materials — ${product.pdp.materials}`);
  }
  if (colour) {
    items.push(`Colour — ${colour.name}`);
  }
  if (product.pdp?.fit) {
    items.push(`Fit — ${product.pdp.fit}`);
  }
  return items;
}
