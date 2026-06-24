"use client";

import { FormEvent, useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  approveArticle,
  archiveArticle,
  listAdminArticles,
  listPendingReviews,
  rejectArticle,
  restoreArticle,
  type ArticleSummary,
  updateAdminArticle,
} from "@/lib/api/articles";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  deleteComment,
  hideComment,
  listAdminComments,
  showComment,
  type CommentItem,
} from "@/lib/api/comments";
import {
  createDomain,
  listDomains,
  updateDomain,
  type DomainSummary,
} from "@/lib/api/domains";
import {
  createModule,
  listModules,
  updateModule,
  type ModuleSummary,
} from "@/lib/api/modules";

type AdminTab = "reviews" | "domains" | "modules" | "content";

const statusLabel: Record<ArticleSummary["status"], string> = {
  draft: "草稿",
  pending_review: "待审核",
  published: "已发布",
  rejected: "已拒绝",
  archived: "已隐藏",
};

export default function AdminPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("reviews");
  const [reviews, setReviews] = useState<ArticleSummary[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [domainDrafts, setDomainDrafts] = useState<
    Record<number, Pick<DomainSummary, "name" | "description" | "sortOrder" | "isActive">>
  >({});
  const [moduleDrafts, setModuleDrafts] = useState<
    Record<number, Pick<ModuleSummary, "domainId" | "name" | "description" | "sortOrder" | "isActive">>
  >({});
  const [newDomain, setNewDomain] = useState({
    slug: "",
    name: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });
  const [newModule, setNewModule] = useState({
    domainId: 0,
    slug: "",
    name: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState("");
  const [error, setError] = useState("");

  const isAdmin = user?.role === "admin";
  const canModerate = Boolean(user);
  const canModerateGlobal = user?.role === "admin" || user?.role === "reviewer";

  async function load() {
    setError("");
    try {
      const current = await getCurrentUser();
      setUser(current);

      const [reviewItems, articleItems] = await Promise.all([
        listPendingReviews(),
        listAdminArticles(),
      ]);
      setReviews(reviewItems);
      setArticles(articleItems);
      setComments(current.role === "admin" || current.role === "reviewer" ? await listAdminComments() : []);

      if (current.role === "admin") {
        const [domainItems, moduleItems] = await Promise.all([
          listDomains(true),
          listModules(true),
        ]);
        setDomains(domainItems);
        setModules(moduleItems);
        setDomainDrafts(
          Object.fromEntries(
            domainItems.map((item) => [
              item.id,
              {
                name: item.name,
                description: item.description,
                sortOrder: item.sortOrder,
                isActive: item.isActive,
              },
            ]),
          ),
        );
        setModuleDrafts(
          Object.fromEntries(
            moduleItems.map((item) => [
              item.id,
              {
                domainId: item.domainId,
                name: item.name,
                description: item.description,
                sortOrder: item.sortOrder,
                isActive: item.isActive,
              },
            ]),
          ),
        );
        setNewModule((currentDraft) => ({
          ...currentDraft,
          domainId: currentDraft.domainId || domainItems[0]?.id || 0,
        }));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError("管理后台加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(key: string, action: () => Promise<unknown>) {
    setActingKey(key);
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("操作失败，请稍后重试");
      }
    } finally {
      setActingKey("");
    }
  }

  async function handleReject(id: number) {
    const note = (notes[id] ?? "").trim();
    if (!note) {
      setError("拒绝时必须填写原因");
      return;
    }
    await act(`reject-${id}`, () => rejectArticle(id, note));
  }

  async function handleCreateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act("create-module", async () => {
      await createModule(newModule);
      setNewModule({
        domainId: domains[0]?.id || 0,
        slug: "",
        name: "",
        description: "",
        sortOrder: 0,
        isActive: true,
      });
    });
  }

  async function handleCreateDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act("create-domain", async () => {
      await createDomain(newDomain);
      setNewDomain({
        slug: "",
        name: "",
        description: "",
        sortOrder: 0,
        isActive: true,
      });
    });
  }

  async function handleUpdateDomain(id: number) {
    const draft = domainDrafts[id];
    if (!draft) {
      return;
    }
    await act(`domain-${id}`, () => updateDomain(id, draft));
  }

  async function handleUpdateModule(id: number) {
    const draft = moduleDrafts[id];
    if (!draft) {
      return;
    }
    await act(`module-${id}`, () => updateModule(id, draft));
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-brass">管理后台</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">站点管理</h1>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <TabButton active={activeTab === "reviews"} onClick={() => setActiveTab("reviews")}>
            文章审核
          </TabButton>
          {isAdmin && (
            <TabButton active={activeTab === "domains"} onClick={() => setActiveTab("domains")}>
              领域管理
            </TabButton>
          )}
          {isAdmin && (
            <TabButton active={activeTab === "modules"} onClick={() => setActiveTab("modules")}>
              版块管理
            </TabButton>
          )}
          <TabButton active={activeTab === "content"} onClick={() => setActiveTab("content")}>
            内容管理
          </TabButton>
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {!loading && canModerate && activeTab === "reviews" && (
          <ReviewPanel
            articles={reviews}
            notes={notes}
            actingKey={actingKey}
            setNotes={setNotes}
            onApprove={(id) => act(`approve-${id}`, () => approveArticle(id, notes[id] ?? "通过"))}
            onReject={handleReject}
          />
        )}

        {!loading && isAdmin && activeTab === "domains" && (
          <DomainPanel
            domains={domains}
            drafts={domainDrafts}
            newDomain={newDomain}
            actingKey={actingKey}
            setDrafts={setDomainDrafts}
            setNewDomain={setNewDomain}
            onCreate={handleCreateDomain}
            onUpdate={handleUpdateDomain}
          />
        )}

        {!loading && isAdmin && activeTab === "modules" && (
          <ModulePanel
            domains={domains}
            modules={modules}
            drafts={moduleDrafts}
            newModule={newModule}
            actingKey={actingKey}
            setDrafts={setModuleDrafts}
            setNewModule={setNewModule}
            onCreate={handleCreateModule}
            onUpdate={handleUpdateModule}
          />
        )}

        {!loading && canModerate && activeTab === "content" && (
          <ContentPanel
            articles={articles}
            comments={comments}
            actingKey={actingKey}
            canArchive={canModerateGlobal}
            canManageComments={canModerateGlobal}
            onArchive={(id) => act(`archive-${id}`, () => archiveArticle(id))}
            onRestore={(id) => act(`restore-${id}`, () => restoreArticle(id))}
            onToggleFeatured={(article) =>
              act(`featured-${article.id}`, () =>
                updateAdminArticle(article.id, { isFeatured: !article.isFeatured }),
              )
            }
            onHideComment={(id) => act(`hide-comment-${id}`, () => hideComment(id))}
            onShowComment={(id) => act(`show-comment-${id}`, () => showComment(id))}
            onDeleteComment={(id) => act(`delete-comment-${id}`, () => deleteComment(id))}
          />
        )}
      </section>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-md px-4 text-sm font-medium ${
        active
          ? "bg-moss text-white"
          : "border border-stone-300 bg-white text-stone-700 hover:border-moss hover:text-moss"
      }`}
    >
      {children}
    </button>
  );
}

function ReviewPanel({
  articles,
  notes,
  actingKey,
  setNotes,
  onApprove,
  onReject,
}: {
  articles: ArticleSummary[];
  notes: Record<number, string>;
  actingKey: string;
  setNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  if (articles.length === 0) {
    return <EmptyState text="暂无待审核投稿" />;
  }

  return (
    <div className="grid gap-4">
      {articles.map((article) => (
        <article key={article.id} className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
          <ArticleHeading article={article} badge="待审核" />
          <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-700">
            {article.contentMd}
          </pre>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-stone-700">审核说明</span>
            <textarea
              value={notes[article.id] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [article.id]: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton disabled={actingKey === `approve-${article.id}`} onClick={() => onApprove(article.id)}>
              通过
            </ActionButton>
            <ActionButton danger disabled={actingKey === `reject-${article.id}`} onClick={() => onReject(article.id)}>
              拒绝
            </ActionButton>
          </div>
        </article>
      ))}
    </div>
  );
}

function DomainPanel({
  domains,
  drafts,
  newDomain,
  actingKey,
  setDrafts,
  setNewDomain,
  onCreate,
  onUpdate,
}: {
  domains: DomainSummary[];
  drafts: Record<number, Pick<DomainSummary, "name" | "description" | "sortOrder" | "isActive">>;
  newDomain: {
    slug: string;
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  };
  actingKey: string;
  setDrafts: React.Dispatch<
    React.SetStateAction<Record<number, Pick<DomainSummary, "name" | "description" | "sortOrder" | "isActive">>>
  >;
  setNewDomain: React.Dispatch<React.SetStateAction<typeof newDomain>>;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (id: number) => void;
}) {
  return (
    <div className="grid gap-5">
      <form onSubmit={onCreate} className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-ink">新建领域</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={newDomain.slug}
            onChange={(event) => setNewDomain((current) => ({ ...current, slug: event.target.value }))}
            placeholder="slug，例如 backend"
            required
            className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          />
          <input
            value={newDomain.name}
            onChange={(event) => setNewDomain((current) => ({ ...current, name: event.target.value }))}
            placeholder="领域名称"
            required
            className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          />
          <input
            type="number"
            value={newDomain.sortOrder}
            onChange={(event) => setNewDomain((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
            className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          />
          <label className="flex h-10 items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={newDomain.isActive}
              onChange={(event) => setNewDomain((current) => ({ ...current, isActive: event.target.checked }))}
            />
            启用
          </label>
        </div>
        <textarea
          value={newDomain.description}
          onChange={(event) => setNewDomain((current) => ({ ...current, description: event.target.value }))}
          placeholder="领域描述"
          rows={3}
          className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
        />
        <ActionButton disabled={actingKey === "create-domain"} className="mt-4">
          新建领域
        </ActionButton>
      </form>

      <div className="grid gap-3">
        {domains.map((domain) => {
          const draft = drafts[domain.id] ?? domain;
          return (
            <div key={domain.id} className="rounded-lg border border-stone-200 bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-500">{domain.slug}</p>
                  <h3 className="font-semibold text-ink">{domain.name}</h3>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">
                  {draft.isActive ? "启用" : "停用"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [domain.id]: { ...draft, name: event.target.value },
                    }))
                  }
                  className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                />
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [domain.id]: { ...draft, sortOrder: Number(event.target.value) },
                    }))
                  }
                  className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                />
              </div>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [domain.id]: { ...draft, description: event.target.value },
                  }))
                }
                rows={3}
                className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [domain.id]: { ...draft, isActive: event.target.checked },
                      }))
                    }
                  />
                  启用
                </label>
                <ActionButton disabled={actingKey === `domain-${domain.id}`} onClick={() => onUpdate(domain.id)}>
                  保存领域
                </ActionButton>
              </div>
            </div>
          );
        })}
        {domains.length === 0 && <EmptyState text="暂无领域" />}
      </div>
    </div>
  );
}

function ModulePanel({
  domains,
  modules,
  drafts,
  newModule,
  actingKey,
  setDrafts,
  setNewModule,
  onCreate,
  onUpdate,
}: {
  domains: DomainSummary[];
  modules: ModuleSummary[];
  drafts: Record<number, Pick<ModuleSummary, "domainId" | "name" | "description" | "sortOrder" | "isActive">>;
  newModule: {
    domainId: number;
    slug: string;
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  };
  actingKey: string;
  setDrafts: React.Dispatch<
    React.SetStateAction<Record<number, Pick<ModuleSummary, "domainId" | "name" | "description" | "sortOrder" | "isActive">>>
  >;
  setNewModule: React.Dispatch<React.SetStateAction<typeof newModule>>;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (id: number) => void;
}) {
  return (
    <div className="grid gap-5">
      <form onSubmit={onCreate} className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-ink">新建版块</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            value={newModule.domainId}
            onChange={(event) => setNewModule((current) => ({ ...current, domainId: Number(event.target.value) }))}
            required
            className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          >
            <option value={0} disabled>
              选择领域
            </option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </select>
          <input
            value={newModule.slug}
            onChange={(event) => setNewModule((current) => ({ ...current, slug: event.target.value }))}
            placeholder="slug，例如 database"
            required
            className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          />
          <input
            value={newModule.name}
            onChange={(event) => setNewModule((current) => ({ ...current, name: event.target.value }))}
            placeholder="版块名称"
            required
            className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          />
          <input
            type="number"
            value={newModule.sortOrder}
            onChange={(event) => setNewModule((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
            className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          />
          <label className="flex h-10 items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={newModule.isActive}
              onChange={(event) => setNewModule((current) => ({ ...current, isActive: event.target.checked }))}
            />
            启用
          </label>
        </div>
        <textarea
          value={newModule.description}
          onChange={(event) => setNewModule((current) => ({ ...current, description: event.target.value }))}
          placeholder="版块描述"
          rows={3}
          className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
        />
        <ActionButton disabled={actingKey === "create-module"} className="mt-4">
          新建版块
        </ActionButton>
      </form>

      <div className="grid gap-3">
        {modules.map((module) => {
          const draft = drafts[module.id] ?? module;
          return (
            <div key={module.id} className="rounded-lg border border-stone-200 bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-500">{module.slug}</p>
                  <h3 className="font-semibold text-ink">{module.name}</h3>
                  <p className="mt-1 text-xs text-stone-500">{module.domainName}</p>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">
                  {draft.isActive ? "启用" : "停用"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={draft.domainId}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [module.id]: { ...draft, domainId: Number(event.target.value) },
                    }))
                  }
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                >
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [module.id]: { ...draft, name: event.target.value },
                    }))
                  }
                  className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                />
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [module.id]: { ...draft, sortOrder: Number(event.target.value) },
                    }))
                  }
                  className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                />
              </div>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [module.id]: { ...draft, description: event.target.value },
                  }))
                }
                rows={3}
                className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [module.id]: { ...draft, isActive: event.target.checked },
                      }))
                    }
                  />
                  启用
                </label>
                <ActionButton disabled={actingKey === `module-${module.id}`} onClick={() => onUpdate(module.id)}>
                  保存版块
                </ActionButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContentPanel({
  articles,
  comments,
  actingKey,
  canArchive,
  canManageComments,
  onArchive,
  onRestore,
  onToggleFeatured,
  onHideComment,
  onShowComment,
  onDeleteComment,
}: {
  articles: ArticleSummary[];
  comments: CommentItem[];
  actingKey: string;
  canArchive: boolean;
  canManageComments: boolean;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onToggleFeatured: (article: ArticleSummary) => void;
  onHideComment: (id: number) => void;
  onShowComment: (id: number) => void;
  onDeleteComment: (id: number) => void;
}) {
  return (
    <div className="grid gap-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">文章内容</h2>
        <div className="grid gap-3">
          {articles.map((article) => (
            <div key={article.id} className="rounded-lg border border-stone-200 bg-white p-5">
              <ArticleHeading article={article} badge={statusLabel[article.status]} />
              <div className="mt-4 flex flex-wrap gap-3">
                <ActionButton
                  disabled={actingKey === `featured-${article.id}`}
                  onClick={() => onToggleFeatured(article)}
                >
                  {article.isFeatured ? "取消精选" : "设为精选"}
                </ActionButton>
                {canArchive && article.status === "published" && (
                  <ActionButton danger disabled={actingKey === `archive-${article.id}`} onClick={() => onArchive(article.id)}>
                    隐藏文章
                  </ActionButton>
                )}
                {canArchive && article.status === "archived" && (
                  <ActionButton disabled={actingKey === `restore-${article.id}`} onClick={() => onRestore(article.id)}>
                    恢复发布
                  </ActionButton>
                )}
              </div>
            </div>
          ))}
          {articles.length === 0 && <EmptyState text="暂无文章" />}
        </div>
      </section>

      {canManageComments && (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">评论内容</h2>
        <div className="grid gap-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-500">
                    文章 #{comment.articleId} / {comment.authorUsername}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{comment.content}</p>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">
                  {comment.visibility === "visible" ? "可见" : "已隐藏"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {comment.visibility === "visible" ? (
                  <ActionButton danger disabled={actingKey === `hide-comment-${comment.id}`} onClick={() => onHideComment(comment.id)}>
                    隐藏评论
                  </ActionButton>
                ) : (
                  <ActionButton disabled={actingKey === `show-comment-${comment.id}`} onClick={() => onShowComment(comment.id)}>
                    恢复评论
                  </ActionButton>
                )}
                <ActionButton danger disabled={actingKey === `delete-comment-${comment.id}`} onClick={() => onDeleteComment(comment.id)}>
                  删除评论
                </ActionButton>
              </div>
            </div>
          ))}
          {comments.length === 0 && <EmptyState text="暂无评论" />}
        </div>
      </section>
      )}
    </div>
  );
}

function ArticleHeading({ article, badge }: { article: ArticleSummary; badge: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs text-stone-500">
          {article.moduleName} / {article.authorUsername}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-ink">{article.title}</h2>
        {article.summary && (
          <p className="mt-2 text-sm leading-6 text-stone-600">{article.summary}</p>
        )}
      </div>
      <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">{badge}</span>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? "border border-red-200 bg-red-50 text-red-700 hover:border-red-300"
          : "bg-moss text-white hover:bg-[#354f42]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
      {text}
    </div>
  );
}
