import { ContentWidth } from "@/components/layout/ContentWidth";
import { Section } from "@/components/layout/Section";
import { ALL_MAJOR_CARDS, SECURE_CARD_PAYMENT } from "@/lib/checkout-copy";
import styles from "./TrustSection.module.css";

const messages = [
  {
    id: "shipping",
    title: "Shipping",
    body: "International shipping. Delivery is expected to take a minimum of 2 weeks.",
  },
  {
    id: "payment",
    title: "Payment",
    body: `${SECURE_CARD_PAYMENT}. ${ALL_MAJOR_CARDS}.`,
  },
  {
    id: "tracking",
    title: "Tracking",
    body: "Every order can be tracked.",
  },
] as const;

export function TrustSection() {
  return (
    <Section labelledBy="trust-heading" compact>
      <ContentWidth className={styles.section}>
        <h2 id="trust-heading" className="visually-hidden">
          Ordering
        </h2>
        <ul className={styles.list}>
          {messages.map((item) => (
            <li key={item.id}>
              <h3 className="text-micro">{item.title}</h3>
              <p className="text-small">{item.body}</p>
            </li>
          ))}
        </ul>
      </ContentWidth>
    </Section>
  );
}
