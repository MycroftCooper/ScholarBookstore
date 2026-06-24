"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { type ArticleSummary } from "@/lib/api/articles";
import { type ModuleSummary } from "@/lib/api/modules";
import { uploadArticleImage } from "@/lib/api/uploads";

export type ArticleEditorValues = {
  title: string;
  summary: string;
  contentMd: string;
  sourceType: ArticleSummary["sourceType"];
  status: Extract<ArticleSummary["status"], "draft" | "pending_review">;
  moduleId: string;
  tags: string[];
};

type ArticleEditorShowcaseProps = {
  mode: "create" | "edit";
  modules: ModuleSummary[];
  values: ArticleEditorValues;
  disabled?: boolean;
  loading?: boolean;
  uploadingImage?: boolean;
  savingStatus?: ArticleEditorValues["status"] | null;
  error?: string;
  success?: string;
  articleId?: number;
  reviewNote?: string;
  editable?: boolean;
  onChange: (values: ArticleEditorValues) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  onSaveDraft?: () => void;
  onSubmitReview?: () => void;
};

const toolbarItems = [
  { label: "H1", before: "# ", after: "" },
  { label: "H2", before: "## ", after: "" },
  { label: "B", before: "**", after: "**" },
  { label: "I", before: "*", after: "*" },
  { label: "“”", before: "> ", after: "" },
  { label: "</>", before: "```\n", after: "\n```" },
  { label: "链", before: "[", after: "](https://)" },
  { label: "列", before: "- ", after: "" },
  { label: "表", before: "\n| 列 A | 列 B |\n| --- | --- |\n| 内容 | 内容 |\n", after: "" },
];

export function ArticleEditorShowcase({
  mode,
  modules,
  values,
  disabled = false,
  loading = false,
  uploadingImage = false,
  savingStatus = null,
  error = "",
  success = "",
  articleId,
  reviewNote,
  editable = true,
  onChange,
  onUploadStateChange,
  onSaveDraft,
  onSubmitReview,
}: ArticleEditorShowcaseProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [preview, setPreview] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const selectedModule = modules.find((item) => String(item.id) === values.moduleId);
  const domainModules = selectedModule
    ? modules.filter((item) => item.domainId === selectedModule.domainId)
    : modules;
  const domains = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    modules.forEach((item) => map.set(item.domainId, { id: item.domainId, name: item.domainName }));
    return Array.from(map.values());
  }, [modules]);
  const wordCount = countWords(values.contentMd);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 500));
  const canEdit = editable && !disabled && !loading;
  const isSaving = savingStatus !== null;

  function update(patch: Partial<ArticleEditorValues>) {
    onChange({ ...values, ...patch });
  }

  function handleDomainChange(domainId: string) {
    const nextModule = modules.find((item) => String(item.domainId) === domainId);
    if (nextModule) {
      update({ moduleId: String(nextModule.id) });
    }
  }

  function addTag(name = tagDraft) {
    const tag = name.trim();
    if (!tag || values.tags.length >= 9) {
      setTagDraft("");
      return;
    }
    if (!values.tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      update({ tags: [...values.tags, tag] });
    }
    setTagDraft("");
  }

  function removeTag(name: string) {
    update({ tags: values.tags.filter((item) => item !== name) });
  }

  function insertSnippet(before: string, after: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      update({ contentMd: `${values.contentMd}${before}${after}` });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = values.contentMd.slice(start, end);
    const next = `${values.contentMd.slice(0, start)}${before}${selected}${after}${values.contentMd.slice(end)}`;
    update({ contentMd: next });
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploadError("");
    onUploadStateChange?.(true);
    try {
      const image = await uploadArticleImage(file, articleId);
      insertSnippet(`![${file.name.replace(/\.[^.]+$/, "") || "图片"}](${image.url})`, "");
    } catch {
      setUploadError("图片上传失败，请稍后重试");
    } finally {
      onUploadStateChange?.(false);
      event.target.value = "";
    }
  }

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
        <span>//</span>
        <span>{mode === "create" ? "Create" : "Edit"}</span>
        <span>//</span>
        <Link href="/domain" className="hover:text-[var(--color-ink)]">
          {selectedModule?.domainName ?? "领域"}
        </Link>
        <span>//</span>
        <span>{mode === "create" ? "新文章" : "编辑文章"}</span>
      </div>

      {loading ? (
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-8 text-sm text-[var(--color-muted)]">
          正在加载编辑器...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <main className="min-w-0 space-y-5">
            <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
              <ContourLayer />
              <div className="relative flex items-center gap-4 px-5 py-4">
                <input
                  value={values.title}
                  onChange={(event) => update({ title: event.target.value.slice(0, 100) })}
                  disabled={!canEdit}
                  maxLength={100}
                  placeholder="输入文章标题..."
                  className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] md:text-3xl"
                />
                <span className="text-sm tabular-nums text-[var(--color-muted)]">
                  {values.title.length}/100
                </span>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <Field label="所属领域">
                <select
                  value={selectedModule?.domainId ?? ""}
                  onChange={(event) => handleDomainChange(event.target.value)}
                  disabled={!canEdit || mode === "edit"}
                  className={selectClass}
                >
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="子版块">
                <select
                  value={values.moduleId}
                  onChange={(event) => update({ moduleId: event.target.value })}
                  disabled={!canEdit || mode === "edit"}
                  className={selectClass}
                >
                  {domainModules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="标签">
                <div className="flex h-11 overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)]">
                  <input
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    disabled={!canEdit || values.tags.length >= 9}
                    placeholder="选择标签"
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => addTag()}
                    className="w-11 border-l border-[var(--color-line)] text-lg text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </Field>
              <Field label="封面图">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => coverInputRef.current?.click()}
                  className="h-11 w-full rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-surface-solid)] text-sm font-semibold text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] hover:text-[var(--color-ink)] disabled:opacity-50"
                >
                  上传封面
                </button>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" />
              </Field>
            </section>

            <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">摘要</h2>
                <span className="text-xs text-[var(--color-muted)]">
                  {values.summary.length}/200
                </span>
              </div>
              <textarea
                value={values.summary}
                onChange={(event) => update({ summary: event.target.value.slice(0, 200) })}
                disabled={!canEdit}
                rows={4}
                placeholder="为文章写一段简短摘要..."
                className="w-full resize-none rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--color-accent-strong)] disabled:opacity-70"
              />
            </section>

            <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-line)] px-4 py-3">
                {toolbarItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => insertSnippet(item.before, item.after)}
                    className="h-9 min-w-9 rounded-md px-3 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)] disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
                <span className="mx-2 h-6 w-px bg-[var(--color-line)]" />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={!canEdit || uploadingImage}
                  className="h-9 rounded-md px-3 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)] disabled:opacity-50"
                >
                  {uploadingImage ? "上传中..." : "插图"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreview((value) => !value)}
                  className="ml-auto h-9 rounded-md px-3 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)]"
                >
                  {preview ? "编辑" : "预览"}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {preview ? (
                <div className="min-h-[560px] bg-[var(--color-surface-solid)] px-6 py-5">
                  <MarkdownContent content={values.contentMd || "暂无正文内容。"} />
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={values.contentMd}
                  onChange={(event) => update({ contentMd: event.target.value })}
                  disabled={!canEdit}
                  placeholder="# 从这里开始写作..."
                  className="min-h-[620px] w-full resize-y bg-[var(--color-surface-solid)] px-6 py-5 font-mono text-sm leading-7 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] disabled:opacity-70"
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] px-5 py-3 text-xs text-[var(--color-muted)]">
                <span>已自动保存 · 2 分钟前</span>
                <span>
                  字数 {wordCount.toLocaleString("zh-CN")}　预计阅读 {readingMinutes} 分钟
                </span>
              </div>
            </section>

            {(error || success || reviewNote || uploadError) && (
              <section className="grid gap-3 text-sm">
                {reviewNote && <Notice tone="warn">审核说明：{reviewNote}</Notice>}
                {uploadError && <Notice tone="error">{uploadError}</Notice>}
                {error && <Notice tone="error">{error}</Notice>}
                {success && <Notice tone="success">{success}</Notice>}
              </section>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <button
                type="button"
                disabled={!canEdit || isSaving || !onSaveDraft}
                onClick={onSaveDraft}
                className="h-14 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-accent-strong)] disabled:opacity-50"
              >
                {savingStatus === "draft" ? "保存中..." : "保存草稿"}
              </button>
              <button
                type="button"
                onClick={() => setPreview((value) => !value)}
                className="h-14 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-accent-strong)]"
              >
                {preview ? "返回编辑" : "预览"}
              </button>
              <button
                type="button"
                disabled={!canEdit || isSaving}
                onClick={onSubmitReview}
                className="h-14 rounded-md bg-[var(--color-ink)] text-sm font-semibold text-[var(--color-page)] shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-50"
              >
                {savingStatus === "pending_review" ? "提交中..." : "提交审核"}
              </button>
            </div>
          </main>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <SideCard title="发布设置">
              <SideField label="可见范围">
                <select className={selectClass} disabled>
                  <option>公开</option>
                </select>
              </SideField>
              <SideField label="投稿状态">
                <select
                  value={values.status}
                  onChange={(event) => update({ status: event.target.value as ArticleEditorValues["status"] })}
                  disabled={!canEdit}
                  className={selectClass}
                >
                  <option value="draft">草稿</option>
                  <option value="pending_review">待审核</option>
                </select>
              </SideField>
              <SideField label="文章来源">
                <select
                  value={values.sourceType}
                  onChange={(event) => update({ sourceType: event.target.value as ArticleSummary["sourceType"] })}
                  disabled={!canEdit}
                  className={selectClass}
                >
                  <option value="original">原创</option>
                  <option value="reprint">转载</option>
                </select>
              </SideField>
              <SideField label="所属领域">
                <div className={readonlyClass}>{selectedModule?.domainName ?? "请选择领域"}</div>
              </SideField>
              <SideField label="子版块">
                <div className={readonlyClass}>{selectedModule?.name ?? "请选择版块"}</div>
              </SideField>
              <SideField label="标签">
                <div className="flex flex-wrap gap-2">
                  {values.tags.length > 0 ? (
                    values.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => removeTag(tag)}
                        className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] disabled:opacity-60"
                      >
                        {tag} ×
                      </button>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--color-muted)]">暂无标签</span>
                  )}
                </div>
              </SideField>
            </SideCard>

            <SideCard title="写作建议">
              <Timeline
                items={[
                  ["使用 Markdown 语法", "支持常见 Markdown 语法，便于排版与结构化展示。"],
                  ["设置高质量封面图", "建议使用清晰、有吸引力的封面图，尺寸建议 1280×720。"],
                  ["完善内容结构", "建议包含明确标题层级、代码示例与总结，提升可读性。"],
                ]}
              />
              <Link href="/about/writing" className="mt-5 inline-flex text-sm font-semibold text-[var(--color-ink)]">
                查看写作规范 →
              </Link>
            </SideCard>

            <SideCard title="审核说明">
              <ul className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
                <li>提交后管理员或对应版块管理者会进行内容审核。</li>
                <li>审核时间通常 1~3 个工作日。</li>
                <li>内容质量、合理性、原创性会影响通过率。</li>
              </ul>
              <Link href="/about/review" className="mt-5 inline-flex text-sm font-semibold text-[var(--color-ink)]">
                了解更多审核规则 →
              </Link>
            </SideCard>
          </aside>
        </div>
      )}
    </div>
  );
}

const selectClass =
  "h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 text-sm outline-none focus:border-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70";

const readonlyClass =
  "min-h-11 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-2.5 text-sm text-[var(--color-ink)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}

function SideField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 text-sm font-semibold text-[var(--color-muted)]">{label}</div>
      {children}
    </div>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Notice({ tone, children }: { tone: "error" | "success" | "warn"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-green-200 bg-green-50 text-green-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return <div className={`rounded-md border px-4 py-3 ${styles[tone]}`}>{children}</div>;
}

function Timeline({ items }: { items: [string, string][] }) {
  return (
    <div className="relative grid gap-5">
      <span className="absolute bottom-4 left-4 top-4 w-px bg-[var(--color-line)]" />
      {items.map(([title, text]) => (
        <div key={title} className="relative flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--color-accent)] bg-[var(--color-surface-solid)] text-xs text-[var(--color-accent-strong)]">
            ○
          </span>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContourLayer() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.16]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 70% 0%, transparent 0 20%, var(--color-line) 20.5% 21%, transparent 21.5% 28%, var(--color-line) 28.5% 29%, transparent 29.5%), radial-gradient(ellipse at 8% 100%, transparent 0 16%, var(--color-line) 16.5% 17%, transparent 17.5% 24%, var(--color-line) 24.5% 25%, transparent 25.5%)",
      }}
    />
  );
}

function countWords(content: string) {
  let count = 0;
  for (const char of content) {
    if (!/\s/.test(char)) {
      count += 1;
    }
  }
  return count;
}
