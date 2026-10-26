import type { RichDoc } from '../shared/types'

/**
 * A plan page is written as questions and answers: pose a question, answer it, pose more, and
 * once it feels concrete, pull out the insights. These types are the editor's block types.
 */
export const QUESTION_BLOCK = 'question'
export const ANSWER_BLOCK = 'answer'
export const INSIGHT_BLOCK = 'insight'

export type QuestionStatus = 'open' | 'answered' | 'parked'

export interface DocQuestion {
  id: string
  text: string
  status: QuestionStatus
  /** The answer written beneath it, in the blocks that follow. */
  answer: string
}

export interface DocInsight {
  id: string
  text: string
}

export interface PlanDigest {
  questions: DocQuestion[]
  insights: DocInsight[]
  open: number
  answered: number
  parked: number
}

interface RawBlock {
  id?: string
  type?: string
  props?: { status?: string }
  content?: unknown
  children?: unknown
}

/** Plain text of a block's inline content (text runs and links). */
export function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((node: { type?: string; text?: string; content?: unknown }) => (node.type === 'text' ? (node.text ?? '') : node.type === 'link' ? inlineText(node.content) : ''))
    .join('')
    .trim()
}

/** Depth-first, in reading order (nested blocks follow their parent). */
function flatten(blocks: unknown, out: RawBlock[] = []): RawBlock[] {
  if (!Array.isArray(blocks)) return out
  for (const b of blocks as RawBlock[]) {
    out.push(b)
    flatten(b.children, out)
  }
  return out
}

/**
 * A question is *answered* once the blocks right after it hold an answer with some text; *parked*
 * when set aside on purpose; otherwise *open*.
 */
export function questionStatus(declared: string | undefined, answer: string): QuestionStatus {
  if (declared === 'parked') return 'parked'
  return answer ? 'answered' : 'open'
}

export function digestOf(doc: RichDoc | undefined): PlanDigest {
  const blocks = flatten(doc)
  const questions: DocQuestion[] = []
  const insights: DocInsight[] = []

  blocks.forEach((b, i) => {
    if (b.type === QUESTION_BLOCK) {
      const answers: string[] = []
      for (let j = i + 1; j < blocks.length && blocks[j].type === ANSWER_BLOCK; j++) {
        const t = inlineText(blocks[j].content)
        if (t) answers.push(t)
      }
      const answer = answers.join('\n')
      questions.push({ id: b.id ?? `q${i}`, text: inlineText(b.content), status: questionStatus(b.props?.status, answer), answer })
    } else if (b.type === INSIGHT_BLOCK) {
      const text = inlineText(b.content)
      if (text) insights.push({ id: b.id ?? `i${i}`, text })
    }
  })

  const asked = questions.filter((q) => q.text)
  return {
    questions: asked,
    insights,
    open: asked.filter((q) => q.status === 'open').length,
    answered: asked.filter((q) => q.status === 'answered').length,
    parked: asked.filter((q) => q.status === 'parked').length,
  }
}
