"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArticleEditorShowcase,
  type ArticleEditorValues,
} from "@/components/articles/ArticleEditorShowcase";
import { SiteFrame } from "@/components/layout/SiteFrame";
import {
  getMyArticle,
  updateMyArticle,
  type ArticleSummary,
} from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";
import { listModules, type ModuleSummary } from "@/lib/api/modules";

type SubmitStatus = Extract<ArticleSummary["status"], "draft" | "pending_review">;

const editableStatuses: ArticleSummary["status"][] = [
  "draft",
  "pending_review",
  "published",
  "rejected",
];

const emptyValues: ArticleEditorValues = {
  title: "",
  summary: "",
  contentMd: "",
  sourceType: "original",
  status: "draft",
  moduleId: "",
  tags: [],
};

export default function EditArticlePage() {
  const params = useParams<{ id: string }>();
  const articleId = Number(params.id);
  const [article, setArticle] = useState<ArticleSummary | null>(null);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [values, setValues] = useState<ArticleEditorValues>(emptyValues);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<SubmitStatus | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isEditable = article ? editableStatuses.includes(article.status) : false;

  useEffect(() => {
    if (!Number.isInteger(articleId) || articleId <= 0) {
      setError("文章不存在");
      setLoading(false);
      return;
    }

    Promise.all([getMyArticle(articleId), listModules()])
      .then(([item, moduleItems]) => {
        setArticle(item);
        setModules(moduleItems);
        setValues({
          title: item.title,
          summary: item.summary,
          contentMd: item.contentMd ?? "",
          sourceType: item.sourceType ?? "original",
          status: item.status === "draft" ? "draft" : "pending_review",
          moduleId: String(item.moduleId),
          tags: item.tags?.map((tag) => tag.name) ?? [],
        });
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
        setError("文章加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [articleId]);

  async function saveArticle(status: SubmitStatus) {
    if (!article || !isEditable) {
      return;
    }
    setError("");
    setSuccess("");

    if (!values.title.trim()) {
      setError("请填写文章标题");
      return;
    }
    if (status === "pending_review" && !values.contentMd.trim()) {
      setError("提交审核前请填写正文");
      return;
    }

    setSavingStatus(status);
    try {
      const updated = await updateMyArticle(article.id, {
        title: values.title,
        summary: values.summary,
        contentMd: values.contentMd,
        sourceType: values.sourceType,
        status,
        tags: values.tags,
      });
      setArticle(updated);
      setValues({
        title: updated.title,
        summary: updated.summary,
        contentMd: updated.contentMd ?? "",
        sourceType: updated.sourceType ?? "original",
        status: updated.status === "draft" ? "draft" : "pending_review",
        moduleId: String(updated.moduleId),
        tags: updated.tags?.map((tag) => tag.name) ?? [],
      });
      setSuccess(
        article.status === "published"
          ? "修订版已提交审核，原文章会继续公开展示"
          : status === "draft"
            ? "草稿已保存"
            : "已提交审核",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败，请稍后重试");
    } finally {
      setSavingStatus(null);
    }
  }

  return (
    <SiteFrame>
      <ArticleEditorShowcase
        mode="edit"
        modules={modules}
        values={values}
        articleId={article?.id}
        editable={isEditable}
        loading={loading}
        uploadingImage={uploadingImage}
        savingStatus={savingStatus}
        error={error}
        success={success}
        reviewNote={article?.reviewNote}
        onChange={setValues}
        onUploadStateChange={setUploadingImage}
        onSaveDraft={article?.status === "draft" ? () => saveArticle("draft") : undefined}
        onSubmitReview={() => saveArticle("pending_review")}
      />
    </SiteFrame>
  );
}
