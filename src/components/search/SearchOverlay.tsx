"use client";

import { useEffect, useId, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { track } from "@/lib/analytics";
import type { SearchDiscoveryLink } from "@/lib/search-query";
import { SearchForm } from "./SearchForm";

type SearchOverlayProps = {
  open: boolean;
  onClose: () => void;
  discovery?: SearchDiscoveryLink[];
};

export function SearchOverlay({
  open,
  onClose,
  discovery = [],
}: SearchOverlayProps) {
  const titleId = useId();
  const [desktop, setDesktop] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(min-width: 1200px)").matches,
  );

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
    if (open) {
      track("search_open");
    }
  }, [open]);

  const form = open ? (
    <SearchForm
      autoFocus
      variant="overlay"
      titleId={titleId}
      discovery={discovery}
      onDismiss={onClose}
    />
  ) : null;

  if (desktop) {
    return (
      <Modal
        id="site-search-dialog"
        open={open}
        onClose={onClose}
        titleId={titleId}
        variant="search"
      >
        {form}
      </Modal>
    );
  }

  return (
    <Drawer
      id="site-search-dialog"
      open={open}
      onClose={onClose}
      titleId={titleId}
      side="full"
    >
      {form}
    </Drawer>
  );
}
