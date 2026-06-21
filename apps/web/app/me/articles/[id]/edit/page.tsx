"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { TagEditor } from "@/components/content/TagEditor";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  getMyArticle,
  updateMyArticle,
  type ArticleSummary,
} from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";
import { uploadArticleImage } from "@/lib/api/uploads";

type SubmitStatus = Extract<ArticleSummary["status"], "draft" | "pending_review">;

const editableStatuses: ArticleSummary["status"][] = [
  "draft",
  "pending_review",
  "published",
  "rejected",
];

const statusLabel: Record<ArticleSummary["status"], string> = {
  draft: "草稿",
  pending_review: "待审核",
  published: "已发布",
  rejected: "已拒绝",
  archived: "已归档",
};

export default function EditArticlePage() {
  const params = useParams<{ id: string }>();
  const articleId = Number(params.id);
  const [article, setArticle] = useState<ArticleSummary | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<SubmitStatus | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isEditable = article ? editableStatuses.includes(article.status) : false;

  useEffect(() => {
    if (!Number.isInteger(articleId) || articleId <= 0) {
      setError("文章不存在");
      setLoading(false);
      return;
    }

    getMyArticle(articleId)
      .then((item) => {
        setArticle(item);
        setTitle(item.title);
        setSummary(item.summary);
        setContentMd(item.contentMd ?? "");
        setTags(item.tags?.map((tag) => tag.name) ?? []);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setError("文章不存在");
          return;
        }
        setError("投稿加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [articleId]);

  async function saveArticle(status: SubmitStatus) {
    if (!article || !isEditable) {
      return;
    }

    setError("");
    setSuccess("");
    if (!title.trim()) {
      setError("请填写标题");
      return;
    }
    if (status === "pending_review" && !contentMd.trim()) {
      setError("提交审核前请填写正文");
      return;
    }

    setSavingStatus(status);
    try {
      const updated = await updateMyArticle(article.id, {
        title,
        summary,
        contentMd,
        status,
        tags,
      });
      setArticle(updated);
      setTitle(updated.title);
      setSummary(updated.summary);
      setContentMd(updated.contentMd ?? "");
      setTags(updated.tags?.map((tag) => tag.name) ?? []);
      setSuccess(
        article.status === "published"
          ? "修订版已提交审核，原文会继续公开展示。"
          : status === "draft"
            ? "草稿已保存。"
            : "已提交审核。",
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("保存失败，请稍后重试");
      }
    } finally {
      setSavingStatus(null);
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !article) {
      return;
    }

    setUploadingImage(true);
    setError("");
    setSuccess("");
    try {
      const image = await uploadArticleImage(file, article.id);
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

  const isSaving = savingStatus !== null;

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <Link
            href="/me/articles"
            className="text-sm font-medium text-moss underline-offset-4 hover:underline"
          >
            返回我的投稿
          </Link>
          <p className="mt-6 text-sm font-medium text-brass">个人中心</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">编辑投稿</h1>
          {article && (
            <p className="mt-3 text-sm text-stone-600">
              当前状态：{statusLabel[article.status]}
            </p>
          )}
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {error && !article && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {article && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
            {!isEditable && (
              <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                当前状态不允许编辑。
              </div>
            )}

            {article.status === "published" && (
              <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                修改已发布文章会创建一个待审核修订版。审核通过前，原文会继续公开展示。
              </div>
            )}

            {article.reviewNote && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                审核说明：{article.reviewNote}
              </div>
            )}

            <div className="mb-4">
              <span className="mb-2 block text-sm font-medium text-stone-700">
                版块
              </span>
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                {article.moduleName}
              </div>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-stone-700">
                标题
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                disabled={!isEditable}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15 disabled:bg-stone-100"
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
                disabled={!isEditable}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15 disabled:bg-stone-100"
              />
            </label>

            <div className="mb-4">
              <span className="mb-2 block text-sm font-medium text-stone-700">
                Tags
              </span>
              <TagEditor tags={tags} onChange={setTags} disabled={!isEditable} />
            </div>

            <div className="mb-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-stone-700">
                <label htmlFor="contentMd">Markdown 正文</label>
                <button
                  type="button"
                  disabled={!isEditable || uploadingImage}
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
                rows={14}
                disabled={!isEditable}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15 disabled:bg-stone-100"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {success}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!isEditable || isSaving}
                onClick={() => saveArticle("pending_review")}
                className="h-11 rounded-md bg-moss px-5 font-medium text-white hover:bg-[#354f42] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingStatus === "pending_review"
                  ? "提交中..."
                  : article.status === "published"
                    ? "提交修订审核"
                    : "提交审核"}
              </button>
              {article.status === "draft" && (
                <button
                  type="button"
                  disabled={!isEditable || isSaving}
                  onClick={() => saveArticle("draft")}
                  className="h-11 rounded-md border border-stone-300 bg-white px-5 font-medium text-stone-700 hover:border-moss hover:text-moss disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingStatus === "draft" ? "保存中..." : "保存草稿"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
