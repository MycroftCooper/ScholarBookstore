import { apiRequest } from "./client";

export type UploadedArticleImage = {
  id: number;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

export function uploadArticleImage(file: File, articleId?: number) {
  const formData = new FormData();
  formData.set("file", file);
  if (articleId) {
    formData.set("articleId", String(articleId));
  }

  return apiRequest<UploadedArticleImage>("/uploads/article-images", {
    method: "POST",
    body: formData,
    headers: {},
  });
}
