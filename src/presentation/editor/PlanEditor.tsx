import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core'
import type { PartialBlock } from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { createReactBlockSpec, getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from '@blocknote/react'
import { HelpCircle, Lightbulb, MessageSquareReply, PenLine } from 'lucide-react'
import type { Attachment } from '@/domain/attachments/Attachment'
import type { EntityRef, RichDoc } from '@/domain/shared/types'
import type { Container } from '@/di/container'
import { useServices } from '@/presentation/app/services'
import { useFileUrl } from '@/presentation/attachments/useAttachments'
import { useEntities, useUserId } from '@/presentation/data/hooks'
import type { DrawingResult } from './DrawingDialog'
import { AnswerBlock, InsightBlock, QuestionBlock, syncQuestionStatuses, thinkingExtension } from './thinkingBlocks'
import { useColorScheme } from './useColorScheme'

const DrawingDialog = lazy(() => import('./DrawingDialog'))

/** Files uploaded from the editor are attachments; the document stores this stable reference. */
export const FILE_SCHEME = 'stiamo-file://'
export const SCENE_MIME = 'application/vnd.excalidraw+json'

interface EditorEnv {
  services: Container
  userId: string
  owner: EntityRef
  ownerTitle: string
  attachments: Attachment[]
  editable: boolean
}

const EditorContext = createContext<EditorEnv | null>(null)

const DrawingBlock = createReactBlockSpec(
  {
    type: 'drawing',
    propSchema: { scene: { default: '' }, preview: { default: '' } },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <DrawingView
        scene={block.props.scene}
        preview={block.props.preview}
        onChange={(props) => editor.updateBlock(block, { type: 'drawing', props })}
      />
    ),
  },
)

const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, drawing: DrawingBlock(), question: QuestionBlock(), answer: AnswerBlock(), insight: InsightBlock() },
})

function DrawingView({ scene, preview, onChange }: { scene: string; preview: string; onChange: (p: { scene: string; preview: string }) => void }) {
  const env = useContext(EditorContext)
  const [open, setOpen] = useState(!scene)
  const sceneFile = env?.attachments.find((a) => a.id === scene)
  const previewFile = env?.attachments.find((a) => a.id === preview)
  const { data: previewUrl } = useFileUrl(previewFile)
  const { data: sceneUrl } = useFileUrl(open ? sceneFile : undefined)

  async function save({ scene: json, png }: DrawingResult) {
    if (!env) return
    const { services, userId, owner, ownerTitle } = env
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const sceneAtt = await services.attachments.attach(userId, owner, ownerTitle, new File([json], `Drawing ${stamp}.excalidraw`, { type: SCENE_MIME }))
    const pngAtt = await services.attachments.attach(userId, owner, ownerTitle, new File([png], `Drawing ${stamp}.png`, { type: 'image/png' }))
    // Replace the previous version so files don't pile up.
    for (const old of [sceneFile, previewFile]) if (old) await services.attachments.remove(userId, old, ownerTitle)
    onChange({ scene: sceneAtt.id, preview: pngAtt.id })
  }

  return (
    <div className="w-full" contentEditable={false}>
      {previewUrl ? (
        <button type="button" onClick={() => env?.editable && setOpen(true)} className="group relative block w-full overflow-hidden rounded-xl border bg-white">
          <img src={previewUrl} alt="Drawing" className="mx-auto max-h-[480px] w-auto" />
          {env?.editable && (
            <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium opacity-0 shadow-float transition-opacity group-hover:opacity-100 max-sm:opacity-100">
              <PenLine className="size-3" /> Edit drawing
            </span>
          )}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 text-sm text-muted-foreground hover:text-foreground">
          <PenLine className="size-4" /> Click to draw
        </button>
      )}
      {open && (
        <Suspense fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-background/60 backdrop-blur-sm"><Spinner label="Opening the drawing board" /></div>}>
          <DrawingDialog open={open} sceneUrl={sceneFile ? sceneUrl : undefined} onSave={save} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

/**
 * The Notion-style page for a plan: type “/” for headings, lists, to-dos, tables, quotes, code,
 * images, video, audio, files — and drawings. Saves itself as you type.
 */
export default function PlanEditor({ owner, ownerTitle, initial, onSave, editable = true }: { owner: EntityRef; ownerTitle: string; initial?: RichDoc; onSave: (doc: RichDoc) => void; editable?: boolean }) {
  const services = useServices()
  const userId = useUserId()
  const scheme = useColorScheme()
  const { data: allAttachments } = useEntities('attachment')
  const attachments = useMemo(() => allAttachments.filter((a) => a.owner.kind === owner.kind && a.owner.id === owner.id), [allAttachments, owner])
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments

  const editor = useCreateBlockNote({
    schema,
    extensions: [thinkingExtension],
    initialContent: initial?.length ? (initial as PartialBlock<typeof schema.blockSchema>[]) : undefined,
    uploadFile: async (file: File) => {
      const att = await services.attachments.attach(userId, owner, ownerTitle, file)
      return `${FILE_SCHEME}${att.id}`
    },
    resolveFileUrl: async (url: string) => {
      if (!url.startsWith(FILE_SCHEME)) return url
      const id = url.slice(FILE_SCHEME.length)
      const att = attachmentsRef.current.find((a) => a.id === id) ?? (await services.crud.attachment.get(userId, id))
      return att ? services.attachments.url(att) : url
    },
  })

  // Debounced autosave.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const dirty = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const flush = () => {
    clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    onSaveRef.current(editor.document as RichDoc)
  }
  // Leaving the page (or closing the tab) saves whatever is still waiting.
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const handleChange = () => {
    syncQuestionStatuses(editor)
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 700)
  }

  const env = useMemo<EditorEnv>(() => ({ services, userId, owner, ownerTitle, attachments, editable }), [services, userId, owner, ownerTitle, attachments, editable])

  return (
    <EditorContext.Provider value={env}>
      <BlockNoteView editor={editor} theme={scheme} editable={editable} onChange={handleChange} slashMenu={false} className="stiamo-editor">
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              [
                // Working a plan out: pose questions, answer them, collect the insights.
                {
                  title: 'Question',
                  subtext: 'Ask something you need to work out',
                  aliases: ['ask', 'q', 'question', '??'],
                  group: 'Thinking',
                  icon: <HelpCircle size={18} />,
                  onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'question' } as never),
                },
                {
                  title: 'Answer',
                  subtext: 'Answer the question above',
                  aliases: ['a', 'answer', 'reply'],
                  group: 'Thinking',
                  icon: <MessageSquareReply size={18} />,
                  onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'answer' } as never),
                },
                {
                  title: 'Insight',
                  subtext: 'Something concrete you’ve worked out',
                  aliases: ['insight', 'learning', 'takeaway', 'conclusion', '!!'],
                  group: 'Thinking',
                  icon: <Lightbulb size={18} />,
                  onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'insight' } as never),
                },
                ...getDefaultReactSlashMenuItems(editor),
                {
                  title: 'Drawing',
                  subtext: 'Sketch or diagram on a canvas',
                  aliases: ['draw', 'sketch', 'whiteboard', 'diagram', 'excalidraw'],
                  group: 'Media',
                  icon: <PenLine size={18} />,
                  onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'drawing' }),
                },
              ],
              query,
            )
          }
        />
      </BlockNoteView>
    </EditorContext.Provider>
  )
}
