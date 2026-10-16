"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { routes } from "@/lib/navigation";
import {
  COOKIE_SETTINGS_EVENT,
  cookieConsentSnapshot,
  readCookieConsent,
  subscribeCookieConsent,
  writeCookieConsent,
} from "@/lib/cookie-consent";
import styles from "./CookieConsent.module.css";

export function CookieConsent() {
  const titleId = useId();
  const descriptionId = useId();
  const snapshot = useSyncExternalStore(subscribeCookieConsent, cookieConsentSnapshot, () => "");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    function openSettings() {
      setAnalytics(readCookieConsent()?.analytics === true);
      setPreferencesOpen(true);
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  function save(nextAnalytics: boolean) {
    writeCookieConsent(nextAnalytics);
    setAnalytics(nextAnalytics);
    setPreferencesOpen(false);
  }

  const bannerOpen = snapshot === "" && !preferencesOpen;

  return (
    <>
      {bannerOpen ? (
        <section className={styles.banner} aria-labelledby="cookie-consent-title">
          <div className={styles.inner}>
            <h2 id="cookie-consent-title" className="text-micro">
              Cookies
            </h2>
            <p className={`text-small ${styles.copy}`}>
              We use strictly necessary cookies to run the bag, checkout, account, and order
              lookup. Analytics and advertising cookies (Meta Pixel) stay off until you allow
              them.{" "}
              <a href={routes.cookies}>Cookie policy</a>
            </p>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => save(true)}>
                Accept all
              </Button>
              <Button type="button" variant="secondary" onClick={() => save(false)}>
                Reject non-essential
              </Button>
              <Button
                type="button"
                variant="tertiary"
                onClick={() => {
                  setAnalytics(false);
                  setPreferencesOpen(true);
                }}
              >
                Manage preferences
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <Modal
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        titleId={titleId}
        descriptionId={descriptionId}
      >
        <div className={styles.dialog}>
          <h2 id={titleId} className="text-h3">
            Cookie preferences
          </h2>
          <p id={descriptionId} className="text-small">
            Necessary cookies stay on because the shop cannot take an order without them. You can
            change this choice at any time from Cookie settings in the footer.
          </p>
          <fieldset className={styles.choices}>
            <legend className="visually-hidden">Cookie categories</legend>
            <label className={styles.choice}>
              <input type="checkbox" checked disabled />
              <span>
                <strong>Strictly necessary</strong>
                <span className="text-small">Bag, checkout, sign-in, and order-lookup protection.</span>
              </span>
            </label>
            <label className={styles.choice}>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
              />
              <span>
                <strong>Analytics and advertising</strong>
                <span className="text-small">
                  Helps us see which pages are used and measures ads with Meta Pixel. Off until
                  you allow it.
                </span>
              </span>
            </label>
          </fieldset>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => save(analytics)}>
              Save preferences
            </Button>
            <a className={styles.policy} href={routes.cookies}>
              Cookie policy
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
}
