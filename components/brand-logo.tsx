import Image from "next/image";

import { LOGO_HEIGHT, LOGO_SRC, LOGO_WIDTH } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, height = 36 }: { className?: string; height?: number }) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Eagle Environmental Services"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      unoptimized
      priority
      className={cn("block w-auto max-w-none shrink-0 object-contain", className)}
      style={{ height, width: "auto" }}
    />
  );
}
