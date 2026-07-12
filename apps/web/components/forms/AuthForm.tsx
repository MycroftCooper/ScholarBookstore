"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { login, register } from "@/lib/api/auth";

type AuthFormProps = {
  mode: "login" | "register";
  variant?: "default" | "tech";
};

export function AuthForm({ mode, variant = "default" }: AuthFormProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";
  const isTech = variant === "tech";
  const passwordHint = useMemo(() => passwordQualityHint(password), [password]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isLogin && password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (!isLogin && !agreedTerms) {
      setError("请先阅读并同意用户协议与隐私政策");
      return;
    }

    setSubmitting(true);

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

  if (isTech) {
    return (
      <form onSubmit={handleSubmit} className="relative w-full">
        <div className="pointer-events-none absolute inset-0 rounded-[20px] border border-slate-200/80" />
        <TechCorner className="left-0 top-0 rounded-tl-[18px] border-l-2 border-t-2" />
        <TechCorner className="right-0 top-0 rounded-tr-[18px] border-r-2 border-t-2" />
        <TechCorner className="bottom-0 left-0 rounded-bl-[18px] border-b-2 border-l-2" />
        <TechCorner className="bottom-0 right-0 rounded-br-[18px] border-b-2 border-r-2" />

        <div className="relative px-5 py-8 sm:px-10 sm:py-10">
          <div className="mb-8">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isLogin ? "// Login" : "// Register"}
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-[#171b22] sm:text-5xl">
              {isLogin ? "欢迎回来" : "创建账号"}
            </h1>
            <p className="mt-4 text-lg font-semibold text-slate-500">
              {isLogin
                ? "登录后继续阅读、投稿与参与讨论"
                : "加入游学书屋，开始你的知识探索之旅"}
            </p>
          </div>

          {!isLogin && (
            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-semibold text-[#171b22]">
                用户名
              </span>
              <span className="flex h-14 items-center rounded-lg border border-slate-200 bg-white px-4 transition focus-within:border-[#f2c200] focus-within:ring-4 focus-within:ring-[#f2c200]/15">
                <span className="text-slate-400">
                  <UserIcon />
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={40}
                  required
                  placeholder="请输入用户名"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-[#171b22] outline-none placeholder:text-slate-400"
                  autoComplete="username"
                />
              </span>
              <span className="mt-2 block text-xs font-medium text-slate-400">
                支持 3-40 个中文、英文、数字或下划线
              </span>
            </label>
          )}

          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-semibold text-[#171b22]">
              邮箱
            </span>
            <span className="flex h-14 items-center rounded-lg border border-slate-200 bg-white px-4 transition focus-within:border-[#f2c200] focus-within:ring-4 focus-within:ring-[#f2c200]/15">
              <MailIcon />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                placeholder={isLogin ? "请输入邮箱" : "请输入邮箱地址"}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-[#171b22] outline-none placeholder:text-slate-400"
                autoComplete="email"
              />
            </span>
          </label>

          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-semibold text-[#171b22]">
              密码
            </span>
            <span className="flex h-14 items-center rounded-lg border border-slate-200 bg-white px-4 transition focus-within:border-[#f2c200] focus-within:ring-4 focus-within:ring-[#f2c200]/15">
              <LockIcon />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                minLength={8}
                required
                placeholder="请输入密码"
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-[#171b22] outline-none placeholder:text-slate-400"
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="grid size-8 place-items-center text-slate-500 transition hover:text-[#171b22]"
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
              >
                <EyeIcon />
              </button>
            </span>
            {!isLogin && (
              <span className={`mt-2 block text-xs font-medium ${passwordHint.className}`}>
                {passwordHint.text}
              </span>
            )}
          </label>

          {!isLogin && (
            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-semibold text-[#171b22]">
                确认密码
              </span>
              <span className="flex h-14 items-center rounded-lg border border-slate-200 bg-white px-4 transition focus-within:border-[#f2c200] focus-within:ring-4 focus-within:ring-[#f2c200]/15">
                <LockIcon />
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  minLength={8}
                  required
                  placeholder="请再次输入密码"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-[#171b22] outline-none placeholder:text-slate-400"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  className="grid size-8 place-items-center text-slate-500 transition hover:text-[#171b22]"
                  aria-label={showConfirmPassword ? "隐藏确认密码" : "显示确认密码"}
                >
                  <EyeIcon />
                </button>
              </span>
            </label>
          )}

          {isLogin && (
            <div className="mb-7 flex items-center justify-between gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-500">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="size-4 rounded border-slate-300 accent-[#f2c200]"
                />
                记住我
              </label>
              <Link
                href="/forgot-password"
                className="text-slate-500 underline-offset-4 hover:text-[#171b22] hover:underline"
              >
                忘记密码？
              </Link>
            </div>
          )}

          {!isLogin && (
            <label className="mb-6 flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-500">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(event) => setAgreedTerms(event.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300 accent-[#f2c200]"
              />
              <span>
                我已阅读并同意
                <span className="mx-1 font-black text-[#d8a900]">《用户协议》</span>
                与
                <span className="ml-1 font-black text-[#d8a900]">《隐私政策》</span>
              </span>
            </label>
          )}

          {error && (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="relative h-16 w-full overflow-hidden rounded-lg bg-[#f2c200] px-4 text-lg font-black text-[#171717] shadow-[0_18px_38px_rgba(242,194,0,0.28)] transition hover:bg-[#ffd426] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="relative z-10 inline-flex items-center gap-8">
              {submitting ? "提交中..." : isLogin ? "登录" : "注册"}
              <span className="text-3xl leading-none">→</span>
            </span>
            <span className="pointer-events-none absolute inset-x-2 bottom-2 top-2 rounded border border-white/55 opacity-70" />
          </button>

          <div className="mt-8 flex items-center gap-5 text-sm font-medium text-slate-500">
            <span className="h-px flex-1 bg-slate-200" />
            <span>
              {isLogin ? "还没有账号？" : "已有账号？"}
              <Link
                href={isLogin ? "/register" : "/login"}
                className="ml-3 font-black text-[#d8a900] underline-offset-4 hover:underline"
              >
                {isLogin ? "立即注册" : "立即登录"}
              </Link>
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

        </div>
      </form>
    );
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

function TechCorner({ className }: { className: string }) {
  return (
    <span
      className={`pointer-events-none absolute z-10 size-6 border-[#f2c200] ${className}`}
      aria-hidden="true"
    />
  );
}

function MailIcon() {
  return (
    <svg className="size-5 text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m5 7 7 6 7-6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="size-5 text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 10h10v9H7z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 10V8a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 14v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function passwordQualityHint(password: string) {
  if (password.length === 0) {
    return { text: "密码长度至少 8 位。可使用更复杂组合，但不会强制限制。", className: "text-slate-400" };
  }
  if (password.length < 8) {
    return { text: "还差一点：密码长度至少 8 位。", className: "text-red-500" };
  }
  const kinds = [
    /[a-zA-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z\d]/.test(password),
  ].filter(Boolean).length;
  if (password.length >= 12 && kinds >= 2) {
    return { text: "强度提示：不错，长度和组合都比较稳。", className: "text-green-600" };
  }
  if (kinds >= 2) {
    return { text: "强度提示：可用。更长的密码会更稳。", className: "text-amber-600" };
  }
  return { text: "强度提示：可注册，但建议混合字母、数字或符号。", className: "text-amber-600" };
}
