import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  content: string;
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content text-base leading-8 text-stone-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-8 text-3xl font-semibold leading-tight text-ink">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-7 text-2xl font-semibold leading-tight text-ink">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-6 text-xl font-semibold leading-tight text-ink">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="my-4">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-moss underline underline-offset-4"
              rel="noreferrer"
              target={href?.startsWith("http") ? "_blank" : undefined}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-2 pl-6">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-2 pl-6">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-5 border-l-4 border-moss/40 bg-stone-50 px-4 py-2 text-stone-700">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-md bg-stone-900 px-4 py-3 font-mono text-sm leading-6 text-stone-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-sm text-stone-900">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-5">{children}</pre>,
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-stone-300 bg-stone-100 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-stone-300 px-3 py-2 align-top">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
