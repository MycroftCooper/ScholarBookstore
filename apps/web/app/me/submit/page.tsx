"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { TagEditor } from "@/components/content/TagEditor";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { createArticle, type ArticleSummary } from "@/lib/api/articles";
import { getCurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listModules, type ModuleSummary } from "@/lib/api/modules";
import { uploadArticleImage } from "@/lib/api/uploads";

type SubmitStatus = Extract<ArticleSummary["status"], "draft" | "pending_review">;

export default function MeSubmitPage() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingStatus, setSubmittingStatus] = useState<SubmitStatus | null>(
    null,
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    id: number;
    status: ArticleSummary["status"];
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await getCurrentUser();
        const items = await listModules();
        setModules(items);
        if (items[0]) {
          setModuleId(String(items[0].id));
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("投稿页面加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function submitArticle(status: SubmitStatus) {
    setError("");
    setCreated(null);

    if (!moduleId) {
      setError("请选择投稿版块");
      return;
    }
    if (!title.trim()) {
      setError("请填写标题");
      return;
    }
    if (status === "pending_review" && !contentMd.trim()) {
      setError("提交审核前请填写正文");
      return;
    }

    setSubmittingStatus(status);
    try {
      const article = await createArticle({
        moduleId: Number(moduleId),
        title,
        summary,
        contentMd,
        status,
        tags,
      });
      setCreated(article);
      setTitle("");
      setSummary("");
      setContentMd("");
      setTags([]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("投稿失败，请稍后重试");
      }
    } finally {
      setSubmittingStatus(null);
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingImage(true);
    setError("");
    try {
      const image = await uploadArticleImage(file);
      insertMarkdownImage(file.name, image.url);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("图片上传失败，请稍后重试");
      }
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  function insertMarkdownImage(filename: string, url: string) {
    const alt = filename.replace(/\.[^.]+$/, "") || "图片";
    const snippet = `![${alt}](${url})`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setContentMd((current) => `${current}${current ? "\n\n" : ""}${snippet}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setContentMd((current) => {
      const prefix = current.slice(0, start);
      const suffix = current.slice(end);
      const before = prefix && !prefix.endsWith("\n") ? "\n\n" : "";
      const after = suffix && !suffix.startsWith("\n") ? "\n\n" : "";
      return `${prefix}${before}${snippet}${after}${suffix}`;
    });

    window.requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + snippet.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  const isSubmitting = submittingStatus !== null;

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-brass">投稿</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">
            提交技术文章
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            可以先保存草稿，也可以直接提交审核。审核通过后文章会公开展示。
          </p>
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {!loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
            {modules.length === 0 ? (
              <div className="rounded-md border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
                暂无可投稿版块
              </div>
            ) : (
              <>
                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    版块
                  </span>
                  <select
                    value={moduleId}
                    onChange={(event) => setModuleId(event.target.value)}
                    className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                  >
                    {modules.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    标题
                  </span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={160}
                    className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                  />
                </label>

                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    摘要
                  </span>
                  <textarea
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    maxLength={300}
                    rows={3}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                  />
                </label>

                <div className="mb-4">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    Tags
                  </span>
                  <TagEditor tags={tags} onChange={setTags} />
                </div>

                <div className="mb-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-stone-700">
                    <label htmlFor="contentMd">Markdown 正文</label>
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadingImage ? "上传中..." : "上传图片"}
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <textarea
                    id="contentMd"
                    ref={textareaRef}
                    value={contentMd}
                    onChange={(event) => setContentMd(event.target.value)}
                    rows={12}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                  />
                </div>

                {error && (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {created && (
                  <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {created.status === "draft"
                      ? "草稿已保存。"
                      : "投稿已提交，当前状态为待审核。"}
                    <Link
                      href={
                        created.status === "draft" ? "/me/drafts" : "/me/articles"
                      }
                      className="ml-1 font-medium underline-offset-4 hover:underline"
                    >
                      {created.status === "draft" ? "查看草稿" : "查看我的投稿"}
                    </Link>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => submitArticle("pending_review")}
                    className="h-11 rounded-md bg-moss px-5 font-medium text-white hover:bg-[#354f42] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingStatus === "pending_review"
                      ? "提交中..."
                      : "提交审核"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => submitArticle("draft")}
                    className="h-11 rounded-md border border-stone-300 bg-white px-5 font-medium text-stone-700 hover:border-moss hover:text-moss disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingStatus === "draft" ? "保存中..." : "保存草稿"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
