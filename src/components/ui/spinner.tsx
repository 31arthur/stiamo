import { cn } from "@/lib/utils"

const SIZES = {
  xs: "size-3",
  sm: "size-4",
  md: "size-6",
  lg: "size-10",
} as const

/**
 * Stiamo's loading mark: the three bars of the logo, filling in turn. One indicator for every wait
 * in the app. `brand` wears the workspace colours; `current` takes the text colour, for use inside
 * buttons and muted text. Announced to screen readers unless it sits next to text that says it.
 */
function Spinner({
  size = "md",
  tone = "brand",
  label = "Loading",
  decorative = false,
  className,
}: {
  size?: keyof typeof SIZES
  tone?: "brand" | "current"
  label?: string
  /** True when nearby text already says what is loading. */
  decorative?: boolean
  className?: string
}) {
  const fill = (brand: string) => (tone === "brand" ? brand : "fill-current")
  return (
    <span
      role={decorative ? undefined : "status"}
      aria-hidden={decorative || undefined}
      className={cn("inline-flex shrink-0", className)}
    >
      <svg viewBox="0 0 24 24" className={cn(SIZES[size])} aria-hidden>
        <rect x="3" y="4.5" width="18" height="3.6" rx="1.8" className={cn("loader-bar", fill("fill-ws-sb"))} style={{ animationDelay: "0s" }} />
        <rect x="3" y="10.2" width="18" height="3.6" rx="1.8" className={cn("loader-bar", fill("fill-ws-fsa"))} style={{ animationDelay: "0.16s" }} />
        <rect x="3" y="15.9" width="18" height="3.6" rx="1.8" className={cn("loader-bar", fill("fill-ws-media"))} style={{ animationDelay: "0.32s" }} />
      </svg>
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  )
}

export { Spinner }
