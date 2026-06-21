"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { UserAvatar } from "@/components/users/UserAvatar";
import {
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  type CurrentUser,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export default function ProfilePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [bio, setBio] = useState("");
  const [school, setSchool] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((current) => {
        setUser(current);
        setBio(current.bio);
        setSchool(current.school);
        setCompany(current.company);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("个人资料加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await updateProfile({ bio, school, company });
      setUser(updated);
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
      setUser(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "头像上传失败，请稍后重试");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-brass">个人中心</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">编辑个人资料</h1>
          <Link
            href="/me"
            className="mt-3 inline-flex text-sm font-medium text-moss underline-offset-4 hover:underline"
          >
            返回个人中心
          </Link>
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {user && (
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft"
          >
            <div className="flex flex-wrap items-center gap-5 border-b border-stone-200 pb-6">
              <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size="lg" />
              <div>
                <h2 className="text-lg font-semibold text-ink">{user.username}</h2>
                <p className="mt-1 text-sm text-stone-500">JPG、PNG、WebP，最大 2MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? "上传中..." : "上传头像"}
                </button>
              </div>
            </div>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-medium text-stone-700">Bio</span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={200}
                rows={4}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
              />
              <span className="mt-1 block text-xs text-stone-500">{bio.length}/200</span>
            </label>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-medium text-stone-700">学校</span>
                <input
                  value={school}
                  onChange={(event) => setSchool(event.target.value)}
                  maxLength={100}
                  className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-stone-700">公司</span>
                <input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  maxLength={100}
                  className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                />
              </label>
            </div>

            {error && (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {saved && (
              <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                已保存
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-md bg-moss px-5 font-medium text-white hover:bg-[#354f42] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存资料"}
              </button>
              <Link
                href="/me"
                className="inline-flex h-11 items-center rounded-md border border-stone-300 bg-white px-5 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss"
              >
                返回个人中心
              </Link>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
