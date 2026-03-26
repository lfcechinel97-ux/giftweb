import { useRef, useState, useEffect, ReactNode } from "react";

interface LazySectionProps {
  children: ReactNode;
  /** How many px before the viewport to start rendering */
  rootMargin?: string;
  /** Minimum height placeholder to avoid CLS */
  minHeight?: number;
}

/**
 * Defers mounting children until the placeholder is near the viewport.
 * Reduces initial DOM node count significantly for long pages.
 */
const LazySection = ({ children, rootMargin = "200px", minHeight = 100 }: LazySectionProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={shouldRender ? undefined : { minHeight }}>
      {shouldRender ? children : null}
    </div>
  );
};

export default LazySection;
