"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { login, register } from "@/lib/api/auth";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(username, email, password);
        await login(email, password);
      }
      window.location.href = "/me";
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("服务暂时不可用，请稍后再试");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-soft"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">
          {isLogin ? "登录" : "注册"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {isLogin
            ? "登录后可以进入个人中心，后续会开放投稿和通知。"
            : "创建账户后会自动登录并进入个人中心。"}
        </p>
      </div>

      {!isLogin && (
        <label className="mb-4 block">
          <span className="mb-2 block text-sm font-medium text-stone-700">
            用户名
          </span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={40}
            required
            className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
            autoComplete="username"
          />
        </label>
      )}

      <label className="mb-4 block">
        <span className="mb-2 block text-sm font-medium text-stone-700">
          邮箱
        </span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          autoComplete="email"
        />
      </label>

      <label className="mb-5 block">
        <span className="mb-2 block text-sm font-medium text-stone-700">
          密码
        </span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          minLength={8}
          required
          className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          autoComplete={isLogin ? "current-password" : "new-password"}
        />
      </label>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="h-11 w-full rounded-md bg-moss px-4 font-medium text-white hover:bg-[#354f42] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "提交中..." : isLogin ? "登录" : "注册"}
      </button>

      <p className="mt-4 text-center text-sm text-stone-600">
        {isLogin ? "还没有账户？" : "已经有账户？"}
        <Link
          href={isLogin ? "/register" : "/login"}
          className="ml-1 font-medium text-moss underline-offset-4 hover:underline"
        >
          {isLogin ? "去注册" : "去登录"}
        </Link>
      </p>
    </form>
  );
}
