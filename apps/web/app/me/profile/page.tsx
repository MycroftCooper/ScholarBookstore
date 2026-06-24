"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { MeSideNav } from "@/components/me/MeSideNav";
import { UserAvatar } from "@/components/users/UserAvatar";
import { listMyArticles, type ArticleSummary } from "@/lib/api/articles";
import {
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  type CurrentUser,
} from "@/lib/api/auth";
import { listBookmarks, type BookmarkedArticle } from "@/lib/api/bookmarks";
import { ApiError } from "@/lib/api/client";
import { listMyComments, type CommentItem } from "@/lib/api/comments";
import {
  getPublicAuthorProfile,
  listFollowers,
  listFollowing,
  type FollowUser,
  type PublicAuthorProfile,
} from "@/lib/api/users";

type PageData = {
  user: CurrentUser;
  profile: PublicAuthorProfile | null;
  articles: ArticleSummary[];
  bookmarks: BookmarkedArticle[];
  comments: CommentItem[];
  following: FollowUser[];
  followers: FollowUser[];
};

type Metrics = {
  published: ArticleSummary[];
  drafts: ArticleSummary[];
  totalBookmarks: number;
  receivedLikes: number;
  followersCount: number;
};

const staticTags = ["后端开发", "Go", "云原生", "系统设计", "技术写作"];

export default function ProfilePage() {
  const [data, setData] = useState<PageData | null>(null);
  const [bio, setBio] = useState("");
  const [school, setSchool] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const user = await getCurrentUser();
    const [profile, articles, bookmarks, comments, following, followers] =
      await Promise.all([
        getPublicAuthorProfile(user.username).catch(() => null),
        listMyArticles().catch(() => []),
        listBookmarks().catch(() => []),
        listMyComments().catch(() => []),
        listFollowing().catch(() => []),
        listFollowers().catch(() => []),
      ]);
    setData({ user, profile, articles, bookmarks, comments, following, followers });
    setBio(user.bio);
    setSchool(user.school);
    setCompany(user.company);
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("个人资料加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo<Metrics | null>(() => {
    if (!data) {
      return null;
    }
    const published = data.articles.filter((item) => item.status === "published");
    return {
      published,
      drafts: data.articles.filter((item) => item.status === "draft"),
      totalBookmarks: data.bookmarks.length,
      receivedLikes: data.comments.reduce((sum, item) => sum + item.upVotes, 0),
      followersCount: data.profile?.followersCount ?? data.followers.length,
    };
  }, [data]);

  const completeness = useMemo(() => {
    if (!data) {
      return 0;
    }
    const checks = [
      Boolean(data.user.avatarUrl),
      Boolean(bio.trim()),
      Boolean(school.trim()),
      Boolean(company.trim()),
      staticTags.length >= 3,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [bio, company, data, school]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await updateProfile({
        bio: bio.trim(),
        school: school.trim(),
        company: company.trim(),
      });
      setData((current) => (current ? { ...current, user: updated } : current));
      setBio(updated.bio);
      setSchool(updated.school);
      setCompany(updated.company);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    setSaved(false);
    setError("");
    try {
      const updated = await uploadAvatar(file);
      setData((current) => (current ? { ...current, user: updated } : current));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "头像上传失败，请稍后重试");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载设置...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {data && metrics && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className="space-y-5">
              <ProfileCard data={data} metrics={metrics} />
              <MeSideNav
                activeHref="/me/profile"
                counts={{
                  following: data.following.length,
                  bookmarks: data.bookmarks.length,
                  comments: data.comments.length,
                }}
              />
            </aside>

            <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
              <HeroCard />
              <Tabs />
              <BasicInfo
                user={data.user}
                bio={bio}
                uploading={uploading}
                onBioChange={setBio}
                onPickAvatar={() => fileInputRef.current?.click()}
                onAvatarChange={handleAvatarChange}
                fileInputRef={fileInputRef}
              />
              <TagPanel />
              <ContactPanel
                user={data.user}
                school={school}
                company={company}
                onSchoolChange={setSchool}
                onCompanyChange={setCompany}
              />
              <DisplayPanel />
              <CoverPanel />

              {saved && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  已保存更改。
                </div>
              )}

              <div className="sticky bottom-4 z-10 grid gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)] md:grid-cols-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 rounded-md bg-[var(--color-accent)] px-5 text-sm font-semibold text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "保存中..." : "保存更改"}
                </button>
                <Link
                  href={`/authors/${data.user.username}`}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-5 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]"
                >
                  预览主页
                </Link>
                <Link
                  href="/me"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-5 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]"
                >
                  取消
                </Link>
              </div>
            </form>

            <aside className="space-y-5">
              <PreviewCard data={data} metrics={metrics} />
              <CompletenessCard value={completeness} />
              <SuggestionCard />
            </aside>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}

function ProfileCard({ data, metrics }: { data: PageData; metrics: Metrics }) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
      <div className="mx-auto w-fit rounded-full border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-2">
        <UserAvatar username={data.user.username} avatarUrl={data.user.avatarUrl} size="lg" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-ink)]">
        {data.user.username}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">@{data.user.username}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {data.user.bio || "热爱技术，热衷分享与思考"}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Badge>{roleLabel(data.user.role)}</Badge>
        {data.user.company && <Badge>{data.user.company}</Badge>}
        {data.user.school && <Badge>{data.user.school}</Badge>}
      </div>
      <div className="mt-6 grid grid-cols-5 gap-2 border-t border-[var(--color-line)] pt-5 text-center">
        <MiniStat label="文章" value={String(metrics.published.length)} />
        <MiniStat label="草稿" value={String(metrics.drafts.length)} />
        <MiniStat label="获赞" value={formatCompact(metrics.receivedLikes)} />
        <MiniStat label="收藏" value={formatCompact(metrics.totalBookmarks)} />
        <MiniStat label="粉丝" value={formatCompact(metrics.followersCount)} />
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
      <ContourLayer />
      <div className="relative">
        <h2 className="text-3xl font-semibold text-[var(--color-ink)]">编辑个人信息</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
          完善你的公开资料，让其他开发者更了解你。
        </p>
      </div>
    </section>
  );
}

function Tabs() {
  const items = ["个人资料", "账号安全", "通知设置", "隐私设置"];
  return (
    <div className="flex gap-6 border-b border-[var(--color-line)] px-1">
      {items.map((item, index) => (
        <button
          key={item}
          type="button"
          disabled={index !== 0}
          className={`border-b-2 px-1 pb-3 text-sm font-semibold ${
            index === 0
              ? "border-[var(--color-accent)] text-[var(--color-ink)]"
              : "border-transparent text-[var(--color-muted)] opacity-60"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function BasicInfo({
  user,
  bio,
  uploading,
  fileInputRef,
  onBioChange,
  onPickAvatar,
  onAvatarChange,
}: {
  user: CurrentUser;
  bio: string;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onBioChange: (value: string) => void;
  onPickAvatar: () => void;
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Panel title="基本信息">
      <div className="grid gap-6 lg:grid-cols-[170px_minmax(0,1fr)]">
        <div>
          <div className="text-sm font-semibold text-[var(--color-muted)]">头像</div>
          <div className="mt-3 grid h-36 place-items-center rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-surface-solid)]">
            <div className="relative">
              <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size="lg" />
              <button
                type="button"
                disabled={uploading}
                onClick={onPickAvatar}
                className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] bg-[var(--color-ink)] text-xs font-semibold text-[var(--color-page)] disabled:opacity-60"
              >
                {uploading ? "..." : "换"}
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onAvatarChange}
            className="hidden"
          />
          <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
            支持 JPG、PNG、WebP，大小不超过 2MB。
          </p>
        </div>

        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="昵称" required>
              <input value={user.username} readOnly className={inputClass} />
            </Field>
            <Field label="用户名" required>
              <input value={user.username} readOnly className={inputClass} />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-[var(--color-muted)]">
            个人主页地址：techplanet.dev/u/{user.username}
          </p>
          <Field label="个人简介" required>
            <textarea
              value={bio}
              onChange={(event) => onBioChange(event.target.value)}
              maxLength={200}
              rows={4}
              className={`${inputClass} h-auto resize-none py-3 leading-6`}
              placeholder="用一句话介绍你的技术方向、经验和兴趣。"
            />
            <div className="mt-1 text-right text-xs text-[var(--color-muted)]">
              {bio.length}/200
            </div>
          </Field>
        </div>
      </div>
    </Panel>
  );
}

function TagPanel() {
  return (
    <Panel title="技术标签 / 擅长领域">
      <div className="flex flex-wrap gap-2">
        {staticTags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-2 text-sm font-semibold text-[var(--color-muted)]"
          >
            {tag}
          </span>
        ))}
        <span className="rounded-md border border-dashed border-[var(--color-line)] px-3 py-2 text-sm font-semibold text-[var(--color-muted)]">
          + 添加标签
        </span>
      </div>
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        标签保存能力后续开放，目前仅作资料展示占位。
      </p>
    </Panel>
  );
}

function ContactPanel({
  user,
  school,
  company,
  onSchoolChange,
  onCompanyChange,
}: {
  user: CurrentUser;
  school: string;
  company: string;
  onSchoolChange: (value: string) => void;
  onCompanyChange: (value: string) => void;
}) {
  return (
    <Panel title="联系方式">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="邮箱（公开显示）">
          <input value={maskEmail(user.email)} readOnly className={inputClass} />
          <p className="mt-1 text-xs text-[var(--color-muted)]">仅展示部分，完整邮箱对他人隐藏。</p>
        </Field>
        <Field label="GitHub">
          <input value="后续开放" readOnly className={inputClass} />
        </Field>
        <Field label="组织 / 公司">
          <input
            value={company}
            onChange={(event) => onCompanyChange(event.target.value)}
            maxLength={100}
            className={inputClass}
            placeholder="例如：独立开发者 / 技术团队"
          />
        </Field>
        <Field label="学校 / 地区">
          <input
            value={school}
            onChange={(event) => onSchoolChange(event.target.value)}
            maxLength={100}
            className={inputClass}
            placeholder="例如：中国 · 杭州"
          />
        </Field>
      </div>
    </Panel>
  );
}

function DisplayPanel() {
  const items = [
    ["在个人主页显示我的邮箱", true],
    ["在个人主页展示我的成就", false],
    ["允许搜索引擎索引我的主页", true],
    ["允许其他用户查看我的关注列表", false],
  ] as const;
  return (
    <Panel title="展示设置">
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(([label, enabled]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-sm text-[var(--color-muted)]">{label}</span>
            <span
              className={`relative h-6 w-11 rounded-full ${
                enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-line)]"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                  enabled ? "right-1" : "left-1"
                }`}
              />
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        展示设置尚未接入后端，当前仅展示设计状态。
      </p>
    </Panel>
  );
}

function CoverPanel() {
  return (
    <Panel title="个人封面">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
        <div className="relative h-20 overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)]">
          <ContourLayer />
        </div>
        <button
          type="button"
          disabled
          className="h-11 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-sm font-semibold text-[var(--color-muted)] opacity-70"
        >
          更换封面
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        封面上传能力后续开放，建议尺寸 1600 x 400px。
      </p>
    </Panel>
  );
}

function PreviewCard({ data, metrics }: { data: PageData; metrics: Metrics }) {
  return (
    <Panel
      title="资料预览"
      action={
        <Link href={`/authors/${data.user.username}`} className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          查看主页 →
        </Link>
      }
    >
      <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-5 text-center">
        <UserAvatar username={data.user.username} avatarUrl={data.user.avatarUrl} size="lg" />
        <h3 className="mt-4 text-xl font-semibold text-[var(--color-ink)]">
          {data.user.username}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">@{data.user.username}</p>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          {bioPreview(data.user.bio)}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {staticTags.slice(0, 3).map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[var(--color-line)] pt-4">
          <MiniStat label="文章" value={String(metrics.published.length)} />
          <MiniStat label="获赞" value={formatCompact(metrics.receivedLikes)} />
          <MiniStat label="粉丝" value={formatCompact(metrics.followersCount)} />
        </div>
      </div>
    </Panel>
  );
}

function CompletenessCard({ value }: { value: number }) {
  const items = [
    ["基本信息", true],
    ["技术标签", true],
    ["联系方式", value >= 60],
    ["展示设置", false],
    ["个人封面", false],
  ] as const;
  return (
    <Panel title="资料完整度">
      <div className="grid gap-5 md:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[120px_minmax(0,1fr)]">
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-[10px] border-[var(--color-accent)] bg-[var(--color-surface-solid)]">
          <div className="text-center">
            <div className="text-2xl font-semibold text-[var(--color-ink)]">{value}%</div>
            <div className="text-xs text-[var(--color-muted)]">优秀</div>
          </div>
        </div>
        <div className="space-y-3">
          {items.map(([label, done]) => (
            <div key={label} className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <span className={done ? "text-green-600" : "text-[var(--color-accent)]"}>
                {done ? "●" : "●"}
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function SuggestionCard() {
  const suggestions = [
    ["个人简介很棒", "你的简介清晰地展示了你的技术兴趣。"],
    ["添加更多技术标签", "标签越具体，越容易被同领域开发者发现。"],
    ["完善个人封面", "一个独特封面能让你的主页更具辨识度。"],
  ];
  return (
    <Panel title="资料优化建议">
      <div className="space-y-4">
        {suggestions.map(([title, text]) => (
          <div key={title} className="flex gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-[var(--color-accent)]">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h4>
              <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h3>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--color-muted)]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function StateCard({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={`rounded-md border p-5 text-sm shadow-[var(--shadow-soft)] ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"
      }`}
    >
      {children}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--color-surface-solid)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
      {children}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{value}</div>
    </div>
  );
}

function ContourLayer() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-50"
      style={{
        backgroundImage:
          "radial-gradient(circle at 80% 20%, rgba(245,197,24,0.18), transparent 12rem), repeating-radial-gradient(circle at 55% 35%, transparent 0 14px, rgba(148,163,184,0.14) 15px 16px)",
      }}
    />
  );
}

function roleLabel(role: CurrentUser["role"]) {
  if (role === "admin") {
    return "管理员";
  }
  if (role === "reviewer") {
    return "审核员";
  }
  return "程序员";
}

function formatCompact(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(value);
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) {
    return email;
  }
  return `${name.slice(0, 1)}***@${domain}`;
}

function bioPreview(value: string) {
  return value.trim() || "热爱技术，热衷分享与思考";
}

const inputClass =
  "h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]";
