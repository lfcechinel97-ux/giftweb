import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = { sm: 40, md: 56, lg: 88, xl: 160 } as const;

interface ThumbProps {
  src?: string | null;
  alt?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Thumb({ src, alt = "", size = "md", className }: ThumbProps) {
  const [failed, setFailed] = useState(false);
  const px = SIZES[size];
  const base: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius: px >= 160 ? 12 : 8,
    border: "1px solid var(--gw-border)",
  };

  if (!src || failed) {
    return (
      <div
        className={cn("flex items-center justify-center shrink-0", className)}
        style={{ ...base, background: "var(--gw-surface-alt)" }}
      >
        <Package size={Math.round(px * 0.4)} style={{ color: "var(--gw-text-muted)" }} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("object-cover shrink-0", className)}
      style={{ ...base, background: "var(--gw-surface)" }}
    />
  );
}

export default Thumb;
