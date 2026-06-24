import Link from "next/link";
import { SiteFrame } from "@/components/layout/SiteFrame";

const rules = [
  {
    title: "审核范围",
    body: "审核会关注文章是否属于所选领域与版块，是否具备基本完整性，是否存在明显广告、灌水、侵权或低质量拼贴内容。",
  },
  {
    title: "审核流程",
    body: "文章提交后进入待审核状态。管理员、领域主或对应版块版主会根据权限范围进行审核，审核通过后文章正式公开展示。",
  },
  {
    title: "常见退回原因",
    body: "标题和正文不匹配、内容过短、代码或结论缺少上下文、转载未说明来源、标签明显不相关，都可能导致退回修改。",
  },
  {
    title: "重新提交",
    body: "被退回的文章可以根据审核说明修改后重新提交。已发布文章再次编辑时会创建修订版，修订版通过审核前，原文章继续展示。",
  },
];

const checklist = [
  "文章主题和所选版块一致",
  "摘要能够说明文章重点",
  "正文结构完整，有明确章节",
  "代码、图片、数据没有明显缺失上下文",
  "转载内容已选择转载类型，并确认授权或来源说明",
];

export default function ReviewRulesPage() {
  return (
    <SiteFrame>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          <Link href="/about" className="hover:text-[var(--color-ink)]">About</Link>
          <span>//</span>
          <span>Review Rules</span>
        </div>

        <header className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
          <h1 className="text-3xl font-semibold text-[var(--color-ink)] md:text-4xl">审核规则</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted)] md:text-base">
            审核的目标不是把内容变得千篇一律，而是确保公开展示的文章有清晰主题、基本质量和可讨论价值。
          </p>
        </header>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          {rules.map((rule) => (
            <article key={rule.title} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
              <h2 className="text-xl font-semibold text-[var(--color-ink)]">{rule.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">{rule.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">提交前自查</h2>
          <div className="mt-5 grid gap-3">
            {checklist.map((item) => (
              <div key={item} className="flex gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-3 text-sm text-[var(--color-muted)]">
                <span className="mt-1 size-4 rounded-full border border-[var(--color-accent)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SiteFrame>
  );
}
