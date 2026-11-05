import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const COMPONENTS: Components = {
  p: ({ children }) => <p className="break-words">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="grid list-disc gap-1 pl-5 marker:text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="grid list-decimal gap-1 pl-5 marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="break-words [&>ol]:mt-1 [&>ul]:mt-1">{children}</li>,
  h1: ({ children }) => <h3 className="font-display text-xl">{children}</h3>,
  h2: ({ children }) => <h3 className="font-display text-lg">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
  h4: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
  blockquote: ({ children }) => <blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>,
  hr: () => <hr className="my-1" />,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:text-primary">
      {children}
    </a>
  ),
  code: ({ children, className }) => (className ? <code className={className}>{children}</code> : <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>),
  pre: ({ children }) => <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{children}</pre>,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1 align-top">{children}</td>,
}

/** An agent's answer: the bold, lists, tables and links it wrote, shown as such. Nothing in it can run: raw HTML is not rendered. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="grid gap-2 text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
