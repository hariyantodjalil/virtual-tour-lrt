"use client";

import dynamic from "next/dynamic";
import SpaceInquiryModal, { type SpaceInquiryModalProps } from "./SpaceInquiryModal";

const LegacyPopup = dynamic(() => import("./InTourSpacePopupLegacy"), { ssr: false });

/** Keep the previous modal available for comparison with ?spaceModal=legacy. */
export default function InTourSpacePopup(props: SpaceInquiryModalProps) {
  const legacy = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("spaceModal") === "legacy";
  return legacy ? <LegacyPopup {...props} /> : <SpaceInquiryModal {...props} />;
}
