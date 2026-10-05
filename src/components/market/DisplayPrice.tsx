"use client";

import { useMarket } from "@/components/market/MarketProvider";
import { formatStorefrontMajor } from "@/lib/market/prices";
import styles from "./DisplayPrice.module.css";

export function DisplayPrice({
  amountMajor,
  className = "",
}: {
  amountMajor: number;
  className?: string;
}) {
  const { country, rates } = useMarket();
  const label = formatStorefrontMajor(amountMajor, country, rates);
  return <span className={className ? `${styles.price} ${className}` : styles.price}>{label}</span>;
}
