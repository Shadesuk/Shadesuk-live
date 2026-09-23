"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

type CampaignImageProps = Omit<ImageProps, "src" | "alt" | "onError"> & {
  src: string;
  alt: string;
};

/**
 * Homepage campaign photo. If the file fails to load, the frame keeps its
 * Soft Stone background and the description stays available to assistive tech.
 */
export function CampaignImage({ alt, className, ...props }: CampaignImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className={className} role="img" aria-label={alt} />;
  }

  return (
    <Image
      {...props}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
