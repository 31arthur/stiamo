import type { EntityRef, ISODate } from '../shared/types'
import type { WorkspaceId } from '../shared/workspace'

/**
 * Stories: every running thing (a case, a client project, a home loan) told in chapters you write. Each story has its own
 * checkpoints (its plot points), the ending you're writing towards, and the work each chapter leaves. People are a cast,
 * learned once and used in every story; what is known about them is evidence, added up by the server into a profile.
 * Only available with the Stiamo backend.
 */

export type StoryState = 'writing' | 'resting' | 'ended'
export type Pacing = 'brisk' | 'steady' | 'slow'
export type Beat = 'progress' | 'setback' | 'twist' | 'lull' | 'breakthrough' | 'note' | 'epilogue'
export type CheckpointStatus = 'ahead' | 'reached' | 'skipped'

export const PACE_DAYS: Record<Pacing, number> = { brisk: 7, steady: 14, slow: 30 }
export const PACING_LABEL: Record<Pacing, string> = { brisk: 'Brisk · weekly', steady: 'Steady · fortnightly', slow: 'Slow · monthly' }
export const BEAT_LABEL: Record<Beat, string> = { progress: 'Progress', setback: 'Setback', twist: 'Twist', lull: 'Lull', breakthrough: 'Breakthrough', note: 'Note', epilogue: 'Epilogue' }

export interface Checkpoint {
  id: string
  title: string
  status: CheckpointStatus
  targetDate?: ISODate
  addedBy?: 'you' | 'twist' | 'template' | 'sketch'
  chapterId?: string
  note?: string
}

export interface Story {
  id: string
  title: string
  workspace: WorkspaceId
  ending: string
  stakes: number
  stakesAmount?: string
  chance?: number
  pacing: Pacing
  state: StoryState
  waitingOn?: { on: string; until?: ISODate }
  checkpoints: Checkpoint[]
  bible: { key: string; value: string }[]
  links: EntityRef[]
  recap?: string
  endedOn?: ISODate
  createdAt?: string
  updatedAt?: string
}

export interface MarginNote {
  kind: 'beat' | 'checkpoint' | 'twist' | 'step' | 'person' | 'hunch' | 'chance' | 'cliffhanger'
  text: string
  quote?: string
  ref?: { kind: string; id: string }
  checkpointId?: string
}

export interface Hunch {
  id: string
  text: string
  quote?: string
  checkOn?: ISODate
  cameTrue?: boolean
}

export interface Chapter {
  id: string
  storyId: string
  number: number
  date: ISODate
  title: string
  prose: string
  beat: Beat
  source: string
  chanceAfter?: number
  notes: MarginNote[]
  hunches: Hunch[]
  cliffhanger?: { question: string; answeredIn?: string }
  people: { name: string; characterId?: string; scene?: string; quote?: string }[]
}

export interface Character {
  id: string
  name: string
  organisation?: string
  title?: string
  phones: string[]
  emails: string[]
  googleContactId?: string
  home: WorkspaceId
  profile?: Profile
}

export type Stance = 'for_us' | 'neutral' | 'wary' | 'against'
export type Sway = 'decides' | 'shapes' | 'informs'

export interface Part {
  id: string
  characterId: string
  storyId: string
  workspace: WorkspaceId
  part: string
  knownAs: string[]
  stance?: Stance
  sway?: Sway
}

export interface Scene {
  id: string
  characterId: string
  storyId: string
  workspace: WorkspaceId
  chapterId?: string
  date: ISODate
  text: string
  quote?: string
  source: 'chapter' | 'answer' | 'you'
}

export interface LensView {
  label: string
  share: number
  weight: number
  confidence: 'high' | 'medium' | 'low'
  evidence: number
  labels: Record<string, number>
  also?: string
  conflict?: string[]
}

export interface Profile {
  lenses: Partial<Record<LensId, LensView>>
  custom?: (LensView & { id: string; name: string; poleA: string; poleB: string })[]
  trackRecord?: { tries: number; answerRate: Record<string, number>; bestHours: string[]; promises?: { kept: number; of: number; avgDaysLate?: number } }
  reads?: Partial<Record<'you' | 'model', { right: number; of: number }>>
  conflicts: string[]
  asOf: ISODate
}

export interface Evidence {
  id: string
  characterId: string
  storyId?: string
  workspace: WorkspaceId
  lens: string
  label: string
  source: 'scene' | 'answer' | 'prediction'
  method: string
  strength: 'clear' | 'weak'
  specific: boolean
  date: ISODate
  quote?: string
  predictedBy?: 'you' | 'model'
  verdict?: 'pending' | 'right' | 'wrong'
  about?: string
}

export interface TimelineEntry {
  kind: 'chapter' | 'hearing'
  date: ISODate
  chapter?: Chapter
  hearing?: { id: string; purpose: string; summary?: string; order?: string; date: ISODate }
}

export interface Timeline {
  story: Story
  here: Checkpoint | null
  progress: number | null
  entries: TimelineEntry[]
  openTasks: { id: string; title: string; dueDate?: ISODate; contact?: string }[]
  openFollowUps: { id: string; title: string; channel: string; due?: { date: ISODate }; contact?: string }[]
  cliffhangers: { chapterId: string; number: number; question: string }[]
  hunches: (Hunch & { chapterId: string; number: number })[]
  cast: { character: Character; part: Part }[]
  chanceTrend: { chapterId: string; number: number; date: ISODate; chance: number }[]
}

export interface StoryMomentum {
  id: string
  title: string
  workspace: WorkspaceId
  state: 'moving' | 'waiting' | 'quiet' | 'resting' | 'ended'
  quietDays: number
  paceDays: number
  rung: number
  score: number
  why: string
  snoozedUntil?: ISODate
}

export interface EditorSettings {
  enabled: boolean
  roomDay: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
}

export interface AiJob {
  name: string
  version: string
  purpose: string
  selection: { providerId: string; modelId: string; thinking?: string } | null
  ownChoice: boolean
}

/** A card the agent made: approving it (through the agent's proposals) is what saves it. */
export interface DraftCard {
  id: string
  title: string
  lines: string[]
}

export type DraftResult =
  | { proposed: true; id: string; title: string; lines: string[]; story: { id: string; title: string }; dropped: string[]; notesOk: boolean }
  | { ask: { id: string; title: string }[] }
  | { none: true; stories: { id: string; title: string }[] }

export interface CharacterView {
  character: Character
  parts: (Part & { story: { id: string; title: string; workspace: WorkspaceId } | null })[]
  scenes: Scene[]
}

export interface StoriesApi {
  stories(): Promise<Story[]>
  saveStory(story: Story): Promise<Story>
  removeStory(id: string): Promise<void>
  timeline(id: string): Promise<Timeline>
  /** The prose as written, with no margin notes (when you'd rather not have any). */
  writeChapter(storyId: string, body: { prose: string; title?: string; date?: ISODate; source?: string }): Promise<{ chapter: Chapter }>
  /** Reads the margin notes from a chapter and puts it on a card to approve. Nothing is saved yet. */
  draftChapter(body: { prose: string; story?: string; title?: string; date?: ISODate }): Promise<DraftResult>
  arcTemplates(): Promise<{ id: string; name: string; workspace: WorkspaceId; checkpoints: string[]; ending: string }[]>
  saveArcTemplate(t: { id: string; name: string; workspace: WorkspaceId; checkpoints: string[]; ending: string }): Promise<void>

  characters(): Promise<Character[]>
  character(id: string): Promise<CharacterView>
  saveCharacter(c: Character): Promise<Character>
  removeCharacter(id: string): Promise<void>
  joinCast(body: { name: string; phones?: string[]; organisation?: string; title?: string; storyId?: string; part?: string; home?: WorkspaceId; characterId?: string }): Promise<{ character: Character; part: Part | null; matched: string }>
  mergeCharacter(id: string, into: string): Promise<Character>
  parts(): Promise<Part[]>
  saveCharacterPart(p: Part): Promise<Part>
  removePart(id: string): Promise<void>
  evidence(): Promise<Evidence[]>
  profile(characterId: string): Promise<Profile>
  /** The people named in a news item or a mail, on a card to add them to the cast. */
  peopleFromText(text: string, story?: string): Promise<{ cards: DraftCard[]; none?: boolean; error?: string }>

  editor(): Promise<{ settings: EditorSettings; stories: StoryMomentum[] }>
  setEditorSettings(s: EditorSettings): Promise<EditorSettings>
  runEditor(workspace?: WorkspaceId): Promise<{ sent: unknown[] }>
  codeScenes(): Promise<{ coded: number; evidence: number; waiting?: number; reason?: string }>
  jobs(): Promise<AiJob[]>
  setJobModel(name: string, choice: { provider: string; model: string; thinking?: string } | null): Promise<AiJob[]>
}

const OFFLINE = 'Stories need the Stiamo backend.'

/** Used when there is no backend (offline, Supabase). */
export const NO_STORIES: StoriesApi = new Proxy({} as StoriesApi, { get: () => () => Promise.reject(new Error(OFFLINE)) })

// --- the arc -----------------------------------------------------------------------------------------------------

/** Where the story is: the first checkpoint not yet reached or skipped. */
export const currentCheckpoint = (s: Pick<Story, 'checkpoints'>) => s.checkpoints.find((c) => c.status === 'ahead') ?? null

export const arcProgress = (s: Pick<Story, 'checkpoints'>) => (s.checkpoints.length ? s.checkpoints.filter((c) => c.status !== 'ahead').length / s.checkpoints.length : null)

/** Checkpoints written one per line, as new checkpoints. */
export function checkpointsFromLines(text: string, newId: () => string): Checkpoint[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, '').trim())
    .filter(Boolean)
    .map((title) => ({ id: newId(), title, status: 'ahead' as const, addedBy: 'you' as const }))
}

/** Moves a checkpoint one place up or down. */
export function moveCheckpoint(list: Checkpoint[], id: string, by: -1 | 1): Checkpoint[] {
  const i = list.findIndex((c) => c.id === id)
  const j = i + by
  if (i < 0 || j < 0 || j >= list.length) return list
  const out = [...list]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

// --- what is known about a person --------------------------------------------------------------------------------

export type LensId = 'talks' | 'decides' | 'wants' | 'under_pressure' | 'trust' | 'moved_by'

export const LENSES: { id: LensId; label: string; asks: string }[] = [
  { id: 'under_pressure', label: 'Under pressure', asks: 'What they do when the news is bad' },
  { id: 'wants', label: 'Wants', asks: 'What they care about most here' },
  { id: 'talks', label: 'Talks', asks: 'How they put things' },
  { id: 'decides', label: 'Decides', asks: 'Their part in the decision' },
  { id: 'trust', label: 'Trust', asks: 'Whose side they act on' },
  { id: 'moved_by', label: 'Moved by', asks: 'What gets them to act' },
]

/** Each label in plain words (the same codebook the server's jobs use). */
export const LABEL_PHRASE: Record<string, string> = {
  straight: 'says things plainly', diplomatic: 'softens what they say', evasive: 'stays vague when pressed',
  decider: 'can say yes themselves', influencer: 'has the decider’s ear', gatekeeper: 'controls what reaches the decider', executor: 'carries out what others decide',
  champion: 'pushes for us on their side', blocker: 'works against it moving', bystander: 'has little say',
  money: 'is moved by money', speed: 'wants it done fast', certainty: 'wants certainty', face: 'minds how it looks', relationship: 'values the relationship',
  control: 'wants to be in control', fairness: 'cares about fairness', avoiding_blame: 'avoids the blame',
  confronts: 'pushes back hard', bargains: 'looks for a trade', solves: 'works the problem', gives_in: 'gives way', goes_quiet: 'goes quiet under bad news',
  agrees_no_delivery: 'agrees, then doesn’t deliver', takes_it_well: 'takes it well',
  ally: 'is on our side', neutral: 'is neutral', wary: 'is wary of us', against: 'works against us',
  authority: 'moves for an authority', others_did_it: 'follows what others do', favour_returned: 'returns favours', own_word: 'keeps to their word when reminded',
  rapport: 'moves for people they like', deadline: 'moves at a deadline', facts: 'moves for facts', unmoved: 'is hard to move',
}

export const phrase = (label: string) => LABEL_PHRASE[label] ?? label.replaceAll('_', ' ')

/** What the profile says in a line or three, only from what is at least fairly sure. */
export function sketchOf(name: string, p: Profile | undefined): string {
  const lenses = p?.lenses ?? {}
  const sure = (Object.entries(lenses) as [LensId, LensView][]).filter(([, v]) => v.confidence !== 'low' && !v.conflict)
  const order: LensId[] = ['under_pressure', 'talks', 'wants', 'trust', 'decides']
  const first = order.flatMap((k) => {
    const v = sure.find(([id]) => id === k)?.[1]
    return v ? [phrase(v.label) + (v.also ? ` and ${phrase(v.also)}` : '')] : []
  })
  const lines = [first.length ? `${name} ${first.slice(0, 3).join(', ')}.` : `Not much is known about ${name} yet.`]
  const tr = p?.trackRecord
  const rates = Object.entries(tr?.answerRate ?? {})
  if (rates.length) {
    const [channel, rate] = rates.sort((a, b) => b[1] - a[1])[0]
    lines.push(`Reach them by ${channel} (answers ${Math.round(rate * 100)}%)${tr?.bestHours.length ? `, best ${tr.bestHours.join(' or ')}` : ''}.`)
  }
  if (tr?.promises) lines.push(`Kept ${tr.promises.kept} of ${tr.promises.of} promised dates.`)
  return lines.join(' ')
}

export const STANCE_LABEL: Record<Stance, string> = { for_us: 'For us', neutral: 'Neutral', wary: 'Wary', against: 'Against' }
export const SWAY_LABEL: Record<Sway, string> = { decides: 'Decides', shapes: 'Shapes', informs: 'Informs' }
