import { cn } from "@/lib/utils"

/** A placeholder block that shimmers while the real content loads. Give it the size of what it stands in for. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("skeleton rounded-md", className)} {...props} />
}

export { Skeleton }
