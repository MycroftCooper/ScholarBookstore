import Link from "next/link";
import { SiteFrame } from "@/components/layout/SiteFrame";

const sections = [
  {
    title: "文章应该解决一个明确问题",
    items: [
      "标题直接说明主题，避免只有情绪或口号。",
      "开头说明背景、适用场景和读者能获得什么。",
      "正文围绕一个核心问题展开，减少和主题无关的散点记录。",
    ],
  },
  {
    title: "结构建议",
    items: [
      "推荐使用一级标题作为文章标题，二级标题组织主要章节，三级标题处理局部细节。",
      "实践类文章建议包含背景、方案、关键实现、踩坑记录、结果复盘。",
      "教程类文章建议包含环境要求、步骤说明、验证方式和常见问题。",
    ],
  },
  {
    title: "代码与图片",
    items: [
      "代码块请标注语言，例如 ```go、```ts、```sql。",
      "截图应清晰完整，避免只截到局部但无法判断上下文。",
      "涉及性能、数据或结论时，尽量给出测试条件和复现方式。",
    ],
  },
  {
    title: "标签与摘要",
    items: [
      "摘要用于帮助读者快速判断是否继续阅读，建议 80 到 160 字。",
      "标签选择具体技术、场景或方法，不要堆叠过宽泛的词。",
      "转载内容请选择转载来源类型，并确保你拥有转载或整理权限。",
    ],
  },
];

export default function WritingGuidePage() {
  return (
    <SiteFrame>
      <GuideLayout
        eyebrow="Writing Guide"
        title="写作规范"
        description="这些规范不是为了限制表达，而是为了让经验更容易被理解、检索和复用。"
      >
        {sections.map((section, index) => (
          <section key={section.title} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-7 place-items-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-[#171717]">
                {index + 1}
              </span>
              <h2 className="text-xl font-semibold text-[var(--color-ink)]">{section.title}</h2>
            </div>
            <ul className="space-y-3 text-sm leading-7 text-[var(--color-muted)]">
              {section.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-3 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </GuideLayout>
    </SiteFrame>
  );
}

function GuideLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
        <Link href="/about" className="hover:text-[var(--color-ink)]">About</Link>
        <span>//</span>
        <span>{eyebrow}</span>
      </div>
      <header className="mb-6 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
        <h1 className="text-3xl font-semibold text-[var(--color-ink)] md:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted)] md:text-base">
          {description}
        </p>
      </header>
      <div className="grid gap-5">{children}</div>
    </div>
  );
}
