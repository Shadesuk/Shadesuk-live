import { MediaSlot, type MediaSlotAsset } from "@/components/media/MediaSlot";

type MediaPlaceholderProps = {
  label: string;
  ratio?: "campaign" | "editorial" | "square" | "story";
  image?: MediaSlotAsset | null;
  compactEmpty?: boolean;
  priority?: boolean;
  className?: string;
};

export function MediaPlaceholder({
  label,
  ratio = "editorial",
  image,
  compactEmpty = false,
  priority = false,
  className,
}: MediaPlaceholderProps) {
  return (
    <MediaSlot
      label={label}
      ratio={ratio}
      image={image}
      compactEmpty={compactEmpty}
      priority={priority}
      className={className}
      sizes="100vw"
    />
  );
}
