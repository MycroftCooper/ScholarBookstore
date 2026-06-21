"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { UserAvatar } from "@/components/users/UserAvatar";
import { ApiError } from "@/lib/api/client";
import {
  followUser,
  getFollowState,
  getPublicAuthorProfile,
  unfollowUser,
  type FollowState,
  type PublicAuthorProfile,
} from "@/lib/api/users";

export default function AuthorProfilePage() {
  const params = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicAuthorProfile | null>(null);
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const username = params.username ? decodeURIComponent(params.username) : "";
    if (!username) {
      setError("用户不存在");
      setLoading(false);
      return;
    }

    getPublicAuthorProfile(username)
      .then((item) => {
        setProfile(item);
        return getFollowState(item.username)
          .then(setFollowState)
          .catch((err) => {
            if (err instanceof ApiError && err.status === 401) {
              setFollowState(null);
              return;
            }
            throw err;
          });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("用户不存在");
          return;
        }
        setError("作者主页加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [params.username]);

  async function handleFollowToggle() {
    if (!profile || acting) {
      return;
    }
    setActing(true);
    try {
      const next = followState?.following
        ? await unfollowUser(profile.username)
        : await followUser(profile.username);
      setFollowState(next);
      setProfile((current) =>
        current
          ? {
              ...current,
              followersCount: next.followersCount,
              followingCount: next.followingCount,
            }
          : current,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError("关注操作失败，请稍后重试");
    } finally {
      setActing(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <Link
          href="/me"
          className="text-sm font-medium text-moss underline-offset-4 hover:underline"
        >
          返回个人中心
        </Link>

        {loading && (
          <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载作者主页...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {profile && (
          <div className="mt-6 grid gap-5">
            <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex items-start gap-4">
                  <UserAvatar
                    username={profile.username}
                    avatarUrl={profile.avatarUrl}
                    size="lg"
                  />
                  <div>
                    <h1 className="text-3xl font-semibold text-ink">
                      {profile.username}
                    </h1>
                    {profile.bio && (
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                        {profile.bio}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-stone-500">
                      {profile.school && <span>{profile.school}</span>}
                      {profile.company && <span>{profile.company}</span>}
                    </div>
                  </div>
                </div>
                {followState ? (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={handleFollowToggle}
                    className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss disabled:opacity-60"
                  >
                    {followState.following ? "已关注" : "关注"}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss"
                  >
                    登录后关注
                  </Link>
                )}
              </div>
              <div className="mt-6 grid gap-3 border-t border-stone-200 pt-5 text-sm text-stone-600 sm:grid-cols-3">
                <Stat label="文章" value={profile.publishedArticleCount} />
                <Stat label="关注者" value={profile.followersCount} />
                <Stat label="正在关注" value={profile.followingCount} />
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-ink">已发布文章</h2>
              {profile.articles.length === 0 ? (
                <div className="mt-4 rounded-md border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
                  该用户暂无文章
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {profile.articles.map((article) => (
                    <Link
                      key={article.id}
                      href={`/articles/${article.id}`}
                      className="rounded-md border border-stone-200 bg-stone-50 p-4 hover:border-stone-300 hover:bg-white"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span>{article.moduleName}</span>
                        {article.publishedAt && (
                          <>
                            <span>/</span>
                            <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                      <h3 className="mt-2 font-medium text-ink">{article.title}</h3>
                      {article.summary && (
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {article.summary}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-stone-50 px-4 py-3">
      <div className="text-xl font-semibold text-ink">{value}</div>
      <div className="mt-1 text-xs text-stone-500">{label}</div>
    </div>
  );
}
