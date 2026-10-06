"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supportedCountry } from "@/contracts/countries";
import { writeCountryCookie } from "@/lib/market/country-cookie";
import type { PublicFxRate } from "@/lib/market/prices";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";

type MarketContextValue = {
  country: string;
  rates: readonly PublicFxRate[];
  setCountry: (code: string) => void;
};

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({
  initialCountry,
  hasChoice,
  rates,
  children,
}: {
  initialCountry: string;
  hasChoice: boolean;
  rates: readonly PublicFxRate[];
  children: ReactNode;
}) {
  const [country, setCountryState] = useState(initialCountry);
  const [chosen, setChosen] = useState(hasChoice);

  const setCountry = useCallback((code: string) => {
    const next = supportedCountry(code)?.code;
    if (!next) {
      return;
    }
    setCountryState(next);
    setChosen(true);
    writeCountryCookie(next);
  }, []);

  useEffect(() => {
    if (chosen || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const response = await fetch("/api/market/locate", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            });
            const body = (await response.json()) as { country?: unknown };
            const next = typeof body.country === "string" ? body.country : CHECKOUT_COUNTRY_GB;
            if (!cancelled) {
              setCountry(next);
            }
          } catch {
            if (!cancelled) {
              setCountry(CHECKOUT_COUNTRY_GB);
            }
          }
        })();
      },
      () => {
        if (!cancelled) {
          setCountry(CHECKOUT_COUNTRY_GB);
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
    return () => {
      cancelled = true;
    };
  }, [chosen, setCountry]);

  const value = useMemo(() => ({ country, rates, setCountry }), [country, rates, setCountry]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const value = useContext(MarketContext);
  if (!value) {
    throw new Error("useMarket must be used within MarketProvider");
  }
  return value;
}
