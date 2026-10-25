import type { Clock, IdGenerator } from '@/domain/shared/Repository'

export const systemClock: Clock = { now: () => new Date() }

export const uuidGenerator: IdGenerator = { next: () => crypto.randomUUID() }
