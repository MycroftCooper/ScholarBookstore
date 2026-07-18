import { apiRequest } from "./client";
import { listArticles } from "./articles";
import { listModules } from "./modules";

export type HomeStats = {
  publishedArticles: number;
  activeModules: number;
  visibleComments: number;
};

export type HomeArticleCard = {
  id: number;
  title: string;
  summary: string;
  moduleSlug: string;
  moduleName: string;
  authorUsername: string;
  commentCount: number;
  publishedAt: string | null;
};

export type HomeModuleInsight = {
  id: number;
  slug: string;
  name: string;
  description: string;
  articleCount: number;
};

export type HomeDiscussion = {
  articleId: number;
  articleTitle: string;
  moduleName: string;
  commentCount: number;
  lastActivityAt: string;
};

export type HomeCreator = {
  id: number;
  username: string;
  publishedCount: number;
  commentCount: number;
};

export type HomeOverview = {
  stats: HomeStats;
  featured: HomeArticleCard[];
  modules: HomeModuleInsight[];
  hotDiscussions: HomeDiscussion[];
  creators: HomeCreator[];
};

export async function getHomeOverview(): Promise<HomeOverview> {
  const [stats, latestArticles, hotArticles, modules] = await Promise.all([
    apiRequest<HomeStats>("/home/stats"),
    listArticles({ sort: "latest", pageSize: 8 }),
    listArticles({ sort: "hot", pageSize: 5 }),
    listModules(),
  ]);

  const creatorStats = new Map<string, HomeCreator>();

  for (const article of latestArticles) {
    const current = creatorStats.get(article.authorUsername) ?? {
      id: article.authorId,
      username: article.authorUsername,
      publishedCount: 0,
      commentCount: 0,
    };
    current.publishedCount += 1;
    current.commentCount += article.commentCount;
    creatorStats.set(article.authorUsername, current);
  }

  return {
    stats,
    featured: latestArticles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      moduleSlug: article.moduleSlug,
      moduleName: article.moduleName,
      authorUsername: article.authorUsername,
      commentCount: article.commentCount,
      publishedAt: article.publishedAt,
    })),
    modules: modules.map((module) => ({
      id: module.id,
      slug: module.slug,
      name: module.name,
      description: module.description,
      articleCount: latestArticles.filter((article) => article.moduleSlug === module.slug).length,
    })),
    hotDiscussions: hotArticles.map((article) => ({
      articleId: article.id,
      articleTitle: article.title,
      moduleName: article.moduleName,
      commentCount: article.commentCount,
      lastActivityAt: article.updatedAt,
    })),
    creators: Array.from(creatorStats.values()).slice(0, 5),
  };
}
