import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReactNode } from "react";

type MarkdownContentProps = {
  content: string;
};

export type TocItem = {
  id: string;
  text: string;
  level: number;
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  const slugCounts = new Map<string, number>();
  const nextHeadingId = (children: ReactNode) =>
    uniqueSlug(extractText(children), slugCounts);

  return (
    <div className="markdown-content text-base leading-8 text-[var(--color-ink)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              id={nextHeadingId(children)}
              className="scroll-mt-24 mb-4 mt-8 text-3xl font-semibold leading-tight text-[var(--color-ink)]"
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              id={nextHeadingId(children)}
              className="scroll-mt-24 mb-3 mt-7 text-2xl font-semibold leading-tight text-[var(--color-ink)]"
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              id={nextHeadingId(children)}
              className="scroll-mt-24 mb-2 mt-6 text-xl font-semibold leading-tight text-[var(--color-ink)]"
            >
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="my-4">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-[var(--color-accent-strong)] underline underline-offset-4"
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
            <blockquote className="my-5 border-l-4 border-[var(--color-accent-strong)] bg-[var(--color-surface-solid)] px-4 py-2 text-[var(--color-muted)]">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                  <code className="block overflow-x-auto rounded-md bg-[var(--color-code)] px-4 py-3 font-mono text-sm leading-6 text-[var(--color-ink)]">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-[var(--color-surface-solid)] px-1.5 py-0.5 font-mono text-sm text-[var(--color-ink)]">
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
            <th className="border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--color-line)] px-3 py-2 align-top">
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

export function buildMarkdownToc(content: string): TocItem[] {
  const slugCounts = new Map<string, number>();
  const items: TocItem[] = [];
  let inFence = false;

  for (const line of content.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const match = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      continue;
    }
    const text = match[2].trim();
    if (!text) {
      continue;
    }
    items.push({
      id: uniqueSlug(text, slugCounts),
      text,
      level: match[1].length,
    });
  }

  return items;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  return "";
}

function uniqueSlug(text: string, counts: Map<string, number>) {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}
