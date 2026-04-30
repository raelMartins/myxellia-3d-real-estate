"use client";

import { EngineBannerLogo } from "@/engine/components/EngineBannerLogo";

export default function EngineTopBanner() {
  return (
    <header
      className="pointer-events-none fixed top-0 left-0 right-0 z-[33] w-full select-none"
      aria-hidden
    >
      <div className="relative w-full border-t border-[#2C2622]">
        <div className="h-4 w-full bg-[#DFD4CC]" />
        <div className="flex justify-center pb-1.5 -mt-2">
          <div className="flex size-13 items-center justify-center rounded-md bg-[#DFD4CC]">
            <EngineBannerLogo />
          </div>
        </div>
      </div>
    </header>
  );
}
