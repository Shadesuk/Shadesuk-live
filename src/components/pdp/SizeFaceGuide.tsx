"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useChrome } from "@/components/navigation/ChromeContext";
import { FACE_GUIDE, shapeCollectionHref, shapeLabel } from "./face-guide";
import { track } from "@/lib/analytics";
import type { ProductMeasurements } from "@/types/catalogue";
import styles from "./SizeFaceGuide.module.css";

type SizeFaceGuideProps = {
  measurements?: ProductMeasurements;
};

export function SizeFaceGuide({ measurements }: SizeFaceGuideProps) {
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const { acquirePageLock, releasePageLock } = useChrome();
  const titleId = useId();

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1200px)");
    function update() {
      setDesktop(media.matches);
    }
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    acquirePageLock();
    return () => releasePageLock();
  }, [open, acquirePageLock, releasePageLock]);

  return (
    <>
      <Button
        variant="tertiary"
        onClick={() => {
          setOpen(true);
          track("open_size_face_guide");
        }}
      >
        Find your fit →
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        titleId={titleId}
        side={desktop ? "right" : "bottom"}
        id="size-face-guide"
      >
        <div className={styles.sheet}>
          <div className={styles.toolbar}>
            <h2 id={titleId} className="text-h3">
              Size & Face Guide
            </h2>
            <Button variant="tertiary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <div className={styles.body}>
            <section className={styles.step} aria-labelledby="fit-step-size">
              <p className="text-micro">01 — Know your size</p>
              <h3 id="fit-step-size" className="text-h3">
                Frame measurements
              </h3>
              <FrameDiagram />
              <ul className="text-small">
                <li>
                  Lens Width — width of one lens
                  {formatMm(measurements?.lensMm)}
                </li>
                <li>
                  Bridge Width — distance between lenses
                  {formatMm(measurements?.bridgeMm)}
                </li>
                <li>
                  Temple Length — length of the arm
                  {formatMm(measurements?.templeMm)}
                </li>
              </ul>
            </section>
            <section className={styles.step} aria-labelledby="fit-step-face">
              <p className="text-micro">02 — Know your face</p>
              <h3 id="fit-step-face" className="text-h3">
                Face-shape guidance
              </h3>
              <p className="text-small">
                This is fashion guidance, not an absolute rule.
              </p>
              <ul className={styles.faces}>
                {FACE_GUIDE.map((face) => (
                  <li key={face.id} className={styles.face}>
                    <h4 className="text-micro">{face.name}</h4>
                    <p className="text-small">
                      Usually flattering: {face.usually.join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <section className={styles.step} aria-labelledby="fit-step-style">
              <p className="text-micro">03 — Find your style</p>
              <h3 id="fit-step-style" className="text-h3">
                Recommended silhouettes
              </h3>
              <div className={styles.links}>
                {FACE_GUIDE.find((face) => face.id === "round")?.shapes.map(
                  (shape) => (
                    <Link key={shape} href={shapeCollectionHref(shape)}>
                      {shapeLabel(shape)}
                    </Link>
                  ),
                )}
              </div>
            </section>
          </div>
        </div>
      </Drawer>
    </>
  );
}

function formatMm(value?: number): string {
  if (value == null) {
    return "";
  }
  return ` — ${value} mm`;
}

function FrameDiagram() {
  return (
    <svg
      className={styles.diagram}
      viewBox="0 0 220 90"
      role="img"
      aria-label="Annotated frame diagram: lens width, bridge width, temple length."
    >
      <rect x="28" y="28" width="64" height="36" fill="none" stroke="currentColor" />
      <rect x="128" y="28" width="64" height="36" fill="none" stroke="currentColor" />
      <path d="M92 46 H128" fill="none" stroke="currentColor" />
      <path d="M28 34 H12" fill="none" stroke="currentColor" />
      <path d="M192 34 H208" fill="none" stroke="currentColor" />
      <text x="60" y="84" textAnchor="middle" fontSize="10">
        Lens
      </text>
      <text x="110" y="20" textAnchor="middle" fontSize="10">
        Bridge
      </text>
      <text x="18" y="20" textAnchor="middle" fontSize="10">
        Temple
      </text>
    </svg>
  );
}
