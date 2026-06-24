"use client";

import { useEffect, useState } from "react";
import {
  ArticleEditorShowcase,
  type ArticleEditorValues,
} from "@/components/articles/ArticleEditorShowcase";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { createArticle, type ArticleSummary } from "@/lib/api/articles";
import { getCurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listModules, type ModuleSummary } from "@/lib/api/modules";

type SubmitStatus = Extract<ArticleSummary["status"], "draft" | "pending_review">;

const initialValues: ArticleEditorValues = {
  title: "",
  summary: "",
  contentMd: "",
  sourceType: "original",
  status: "draft",
  moduleId: "",
  tags: [],
};

export default function MeSubmitPage() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [values, setValues] = useState<ArticleEditorValues>(initialValues);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<SubmitStatus | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function load() {
      try {
        await getCurrentUser();
        const items = await listModules();
        setModules(items);
        setValues((current) => ({
          ...current,
          moduleId: current.moduleId || (items[0] ? String(items[0].id) : ""),
        }));
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
    setSuccess("");

    if (!values.moduleId) {
      setError("请选择投稿版块");
      return;
    }
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
      const article = await createArticle({
        moduleId: Number(values.moduleId),
        title: values.title,
        summary: values.summary,
        contentMd: values.contentMd,
        sourceType: values.sourceType,
        status,
        tags: values.tags,
      });
      setSuccess(article.status === "draft" ? "草稿已保存" : "文章已提交审核");
      setValues({
        ...initialValues,
        moduleId: values.moduleId,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "投稿失败，请稍后重试");
    } finally {
      setSavingStatus(null);
    }
  }

  return (
    <SiteFrame>
      <ArticleEditorShowcase
        mode="create"
        modules={modules}
        values={values}
        loading={loading}
        uploadingImage={uploadingImage}
        savingStatus={savingStatus}
        error={error}
        success={success}
        onChange={setValues}
        onUploadStateChange={setUploadingImage}
        onSaveDraft={() => submitArticle("draft")}
        onSubmitReview={() => submitArticle("pending_review")}
      />
    </SiteFrame>
  );
}
