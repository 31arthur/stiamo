import type { Transition, Variants } from 'motion/react'

/** Shared motion language: quick, soft springs; nothing bounces more than once. */
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
  soft: { type: 'spring', stiffness: 260, damping: 30 },
  gentle: { type: 'spring', stiffness: 160, damping: 24 },
} satisfies Record<string, Transition>

export const easeOutExpo = [0.16, 1, 0.3, 1] as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: easeOutExpo } },
}

export const stagger = (staggerChildren = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
})

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.85, y: 4 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.snappy },
  exit: { opacity: 0, scale: 0.85, transition: { duration: 0.15 } },
}
