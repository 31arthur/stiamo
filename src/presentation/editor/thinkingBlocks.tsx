import { createExtension } from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import { Lightbulb, PauseCircle, PlayCircle } from 'lucide-react'
import { ANSWER_BLOCK, INSIGHT_BLOCK, inlineText, QUESTION_BLOCK, questionStatus } from '@/domain/plans/planDoc'
import type { QuestionStatus } from '@/domain/plans/planDoc'
import { cn } from '@/lib/utils'

/**
 * Blocks for thinking a plan through the way you'd do it on paper: ask a question, answer it, ask
 * more, and when it feels concrete mark the insights. Questions know whether they've been answered.
 */

const STATUS_STYLE: Record<QuestionStatus, { label: string; chip: string }> = {
  open: { label: 'Open', chip: 'bg-warning/15 text-warning' },
  answered: { label: 'Answered', chip: 'bg-success/12 text-success' },
  parked: { label: 'Parked', chip: 'bg-muted text-muted-foreground' },
}

export const QuestionBlock = createReactBlockSpec(
  {
    type: QUESTION_BLOCK,
    propSchema: { status: { default: 'open', values: ['open', 'answered', 'parked'] as const } },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      // During a conversion to another block type the props can briefly be empty.
      const status = (block.props.status as QuestionStatus | undefined) ?? 'open'
      const style = STATUS_STYLE[status] ?? STATUS_STYLE.open
      const parked = status === 'parked'
      return (
        <div className={cn('qa-row qa-question', parked && 'opacity-60')} data-status={status}>
          <span className="qa-mark qa-mark-q" contentEditable={false}>
            Q
          </span>
          <div ref={contentRef} className="qa-text qa-text-question" data-hint="Type a question…" />
          <button
            type="button"
            contentEditable={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.updateBlock(block, { props: { status: parked ? 'open' : 'parked' } } as never)}
            title={parked ? 'Pick this question up again' : 'Park this question for later'}
            className={cn('qa-chip inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium select-none', style.chip)}
          >
            {parked ? <PlayCircle className="size-3" /> : status === 'open' ? <PauseCircle className="qa-chip-icon size-3" /> : null}
            {style.label}
          </button>
        </div>
      )
    },
  },
)

export const AnswerBlock = createReactBlockSpec(
  { type: ANSWER_BLOCK, propSchema: {}, content: 'inline' },
  {
    render: ({ contentRef }) => (
      <div className="qa-row qa-answer">
        <span className="qa-mark qa-mark-a" contentEditable={false}>
          A
        </span>
        <div ref={contentRef} className="qa-text" data-hint="Your answer…" />
      </div>
    ),
  },
)

export const InsightBlock = createReactBlockSpec(
  { type: INSIGHT_BLOCK, propSchema: {}, content: 'inline' },
  {
    render: ({ contentRef }) => (
      <div className="qa-row qa-insight">
        <span className="qa-mark qa-mark-i" contentEditable={false}>
          <Lightbulb className="size-3.5" />
        </span>
        <div ref={contentRef} className="qa-text qa-text-insight" data-hint="What did you work out?" />
      </div>
    ),
  },
)

type AnyEditor = {
  document: { id: string; type: string; props: Record<string, unknown>; content?: unknown; children: unknown[] }[]
  updateBlock: (b: string, u: unknown) => unknown
}

function flatten(blocks: AnyEditor['document'], out: AnyEditor['document'] = []) {
  for (const b of blocks) {
    out.push(b)
    flatten(b.children as AnyEditor['document'], out)
  }
  return out
}

/** Keeps each question's chip honest: answered once an answer with text sits beneath it. */
export function syncQuestionStatuses(editor: unknown) {
  const ed = editor as AnyEditor
  const blocks = flatten(ed.document)
  blocks.forEach((b, i) => {
    if (b.type !== QUESTION_BLOCK) return
    let answer = ''
    for (let j = i + 1; j < blocks.length && blocks[j].type === ANSWER_BLOCK; j++) answer += inlineText(blocks[j].content)
    const next = questionStatus(b.props.status as string, answer)
    if (next !== b.props.status) ed.updateBlock(b.id, { props: { status: next } })
  })
}

/** True when the text cursor sits at the very end of its block (so Enter means "next", not "split"). */
function cursorAtEnd(editor: { prosemirrorState: { selection: { empty: boolean; $from: { parentOffset: number; parent: { content: { size: number } } } } } }) {
  const { selection } = editor.prosemirrorState
  return selection.empty && selection.$from.parentOffset === selection.$from.parent.content.size
}

/**
 * The rhythm of working it out: Enter on a question opens its answer; Enter on a filled answer
 * adds another line of answer; Enter on an empty answer starts the next question. `?? ` and `!! `
 * at the start of a line turn it into a question or an insight.
 */
export const thinkingExtension = createExtension({
  key: 'stiamo-thinking',
  keyboardShortcuts: {
    Enter: ({ editor }) => {
      const { block } = editor.getTextCursorPosition()
      if (block.type === QUESTION_BLOCK || block.type === ANSWER_BLOCK) {
        const isQuestion = block.type === QUESTION_BLOCK
        if (!isQuestion && !inlineText(block.content)) {
          editor.updateBlock(block, { type: QUESTION_BLOCK, props: { status: 'open' } } as never)
          return true
        }
        if (!cursorAtEnd(editor as never)) return false
        const next = editor.getNextBlock(block)
        if (isQuestion && next?.type === ANSWER_BLOCK) {
          editor.setTextCursorPosition(next, 'end')
          return true
        }
        const [created] = editor.insertBlocks([{ type: ANSWER_BLOCK }] as never, block, 'after')
        editor.setTextCursorPosition(created, 'start')
        return true
      }
      return false
    },
  },
  inputRules: [
    { find: /^\?\?\s$/, replace: () => ({ type: QUESTION_BLOCK, props: { status: 'open' }, content: [] }) as never },
    { find: /^!!\s$/, replace: () => ({ type: INSIGHT_BLOCK, content: [] }) as never },
  ],
})
