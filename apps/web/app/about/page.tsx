import Link from "next/link";
import { SiteFrame } from "@/components/layout/SiteFrame";

const cards = [
  {
    title: "写作规范",
    description: "了解文章结构、标题层级、代码示例、图片与标签的基本要求。",
    href: "/about/writing",
    meta: "Writing Guide",
  },
  {
    title: "审核规则",
    description: "了解投稿审核范围、处理流程、退回原因和重新提交建议。",
    href: "/about/review",
    meta: "Review Rules",
  },
];

export default function AboutPage() {
  return (
    <SiteFrame>
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          <span>//</span>
          <span>About</span>
          <span>//</span>
          <span>技术星球</span>
        </div>

        <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)] md:p-9">
          <div className="pointer-events-none absolute inset-0 opacity-[0.14]" style={{
            backgroundImage:
              "radial-gradient(ellipse at 80% 0%, transparent 0 18%, var(--color-line) 18.5% 19%, transparent 19.5% 25%, var(--color-line) 25.5% 26%, transparent 26.5%)",
          }} />
          <div className="relative max-w-3xl">
            <h1 className="text-3xl font-semibold leading-tight text-[var(--color-ink)] md:text-4xl">
              关于技术星球
            </h1>
            <p className="mt-4 text-sm leading-7 text-[var(--color-muted)] md:text-base">
              技术星球是一个围绕游戏研发、工程实践、工具链与产品运营沉淀经验的知识社区。
              我们鼓励作者发布可复用、可讨论、可验证的文章，也希望每一篇内容都能帮助读者少踩一个坑，多打开一条思路。
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-accent-strong)]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                {card.meta}
              </div>
              <h2 className="mt-3 text-xl font-semibold text-[var(--color-ink)]">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">{card.description}</p>
              <div className="mt-5 text-sm font-semibold text-[var(--color-ink)]">查看详情 →</div>
            </Link>
          ))}
        </section>
      </div>
    </SiteFrame>
  );
}
