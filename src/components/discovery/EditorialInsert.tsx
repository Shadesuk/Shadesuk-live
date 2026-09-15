import { MediaSlot, type MediaSlotAsset } from "@/components/media/MediaSlot";
import type { ReactNode } from "react";
import styles from "./EditorialInsert.module.css";

type EditorialInsertProps = {
  title?: string;
  image?: MediaSlotAsset | null;
  children?: ReactNode;
};

export function EditorialInsert({ title, image, children }: EditorialInsertProps) {
  return (
    <aside className={styles.insert}>
      <MediaSlot
        label="Editorial photography"
        ratio="editorial"
        image={image}
        sizes="100vw"
      />
      {title ? <p className="text-h3">{title}</p> : null}
      {children}
    </aside>
  );
}
