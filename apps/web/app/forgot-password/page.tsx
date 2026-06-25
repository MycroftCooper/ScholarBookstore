"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/domain", label: "领域" },
  { href: "/discover", label: "发现" },
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("找回密码后端接口尚未接入，当前未发送重置邮件。");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfbfa] text-[#171b22]">
      <header className="relative z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-4">
            <span className="grid size-11 place-items-center rounded-lg bg-[#15191f] text-lg font-black text-[#f2c200] shadow-[0_10px_26px_rgba(15,23,42,0.18)]">
              游
            </span>
            <span className="truncate text-xl font-black tracking-tight sm:text-2xl">
              游学书屋
            </span>
          </Link>

          <nav className="hidden items-center gap-16 text-base font-bold md:flex">
            {navItems.map((item) => (
              <span key={item.label} className="relative py-7">
                <Link href={item.href}>{item.label}</Link>
                {item.href === "/" && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-1 w-11 bg-[#f2c200]" />
                )}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <section className="relative min-h-[calc(100vh-80px)]">
        <ContourField />
        <SideRuler />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-28 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,600px)_1fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-20">
          <div className="rounded-[20px] border border-slate-200/80 bg-white/[0.92] p-4 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur">
            <ResetPasswordForm
              email={email}
              notice={notice}
              onEmailChange={setEmail}
              onSubmit={handleSubmit}
            />
          </div>

          <section className="relative hidden min-h-[560px] lg:block" aria-label="游学书屋安全重置装饰图形">
            <KeyGraphic />
          </section>
        </div>

        <footer className="absolute inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 text-xs font-semibold text-slate-500 md:flex-row md:items-center md:justify-between lg:px-8">
            <p>© 2024 游学书屋 · 沉淀游戏研发、工程实践与创作经验</p>
            <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
              <Link href="/about">关于我们</Link>
              <span>联系我们</span>
              <span>帮助中心</span>
              <span>隐私政策</span>
              <span>用户协议</span>
              <span className="hidden h-6 w-px bg-slate-200 md:block" />
              <span className="inline-flex items-center gap-2">
                <SunIcon />
                简体中文
              </span>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}

function ResetPasswordForm({
  email,
  notice,
  onEmailChange,
  onSubmit,
}: {
  email: string;
  notice: string;
  onEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <div className="pointer-events-none absolute inset-0 rounded-[20px] border border-slate-200/80" />
      <TechCorner className="left-0 top-0 rounded-tl-[18px] border-l-2 border-t-2" />
      <TechCorner className="right-0 top-0 rounded-tr-[18px] border-r-2 border-t-2" />
      <TechCorner className="bottom-0 left-0 rounded-bl-[18px] border-b-2 border-l-2" />
      <TechCorner className="bottom-0 right-0 rounded-br-[18px] border-b-2 border-r-2" />

      <div className="relative px-5 py-8 sm:px-10 sm:py-10">
        <div className="mb-9">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            // Reset Password
          </p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-[#171b22] sm:text-5xl">
            找回密码
          </h1>
          <p className="mt-4 text-lg font-semibold text-slate-500">
            输入账号绑定的邮箱，我们将向你发送重置链接
          </p>
        </div>

        <label className="mb-5 block">
          <span className="mb-2 block text-sm font-semibold text-[#171b22]">
            邮箱地址
          </span>
          <span className="flex h-14 items-center rounded-lg border border-slate-200 bg-white px-4 transition focus-within:border-[#f2c200] focus-within:ring-4 focus-within:ring-[#f2c200]/15">
            <MailIcon />
            <input
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              type="email"
              required
              placeholder="请输入注册时使用的邮箱"
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-[#171b22] outline-none placeholder:text-slate-400"
              autoComplete="email"
            />
          </span>
        </label>

        <p className="mb-9 flex items-center gap-2 text-sm font-medium text-slate-500">
          <InfoIcon />
          请填写注册时使用的邮箱
        </p>

        {notice && (
          <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {notice}
          </div>
        )}

        <button
          type="submit"
          className="relative h-16 w-full overflow-hidden rounded-lg bg-[#f2c200] px-4 text-lg font-black text-[#171717] shadow-[0_18px_38px_rgba(242,194,0,0.28)] transition hover:bg-[#ffd426]"
        >
          <span className="relative z-10 inline-flex items-center gap-8">
            发送重置链接
            <span className="text-3xl leading-none">→</span>
          </span>
          <span className="pointer-events-none absolute inset-x-2 bottom-2 top-2 rounded border border-white/55 opacity-70" />
        </button>

        <div className="my-8 flex items-center gap-5 text-sm font-medium text-slate-500">
          <span className="h-px flex-1 bg-slate-200" />
          <span>或</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-4 text-lg font-black text-slate-500 underline-offset-4 hover:text-[#171b22] hover:underline"
          >
            返回登录
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mt-8 flex items-center gap-5 rounded-lg border border-slate-200 bg-white/70 p-4 text-sm font-medium text-slate-500">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-slate-200 text-[#d8a900]">
            <MailBadgeIcon />
          </span>
          <span>
            下一步：
            <span className="ml-2">查收邮箱</span>
            <span className="mx-3">→</span>
            <span>打开链接</span>
            <span className="mx-3">→</span>
            <span>设置新密码</span>
          </span>
        </div>
      </div>
    </form>
  );
}

function SideRuler() {
  return (
    <div className="pointer-events-none absolute left-8 top-24 hidden h-[70%] flex-col items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 xl:flex">
      <span className="h-1.5 w-1.5 rounded-full border border-slate-500" />
      <span className="-rotate-90">01</span>
      <span className="h-40 w-px bg-slate-200" />
      <span className="-rotate-90">游学书屋</span>
      <span className="size-2 bg-[#f2c200]" />
      <span className="h-20 w-px bg-slate-200" />
    </div>
  );
}

function ContourField() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden="true">
      <div className="absolute inset-y-0 right-[-10%] w-[70%] rounded-full bg-[radial-gradient(circle_at_center,rgba(242,194,0,0.08),transparent_62%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.025)_1px,transparent_1px)] bg-[size:80px_80px] opacity-30" />
      <svg className="absolute right-[-8%] top-0 h-full w-[78%]" viewBox="0 0 900 760" fill="none">
        {Array.from({ length: 16 }).map((_, index) => (
          <path
            key={index}
            d={`M${120 + index * 18} ${90 + index * 16} C ${260 + index * 10} ${10 + index * 18}, ${500 - index * 9} ${180 + index * 10}, ${740 - index * 4} ${90 + index * 20} S ${880 - index * 8} ${520 + index * 8}, ${520 - index * 5} ${620 + index * 5} S ${150 + index * 8} ${570 - index * 7}, ${170 + index * 12} ${320 + index * 7}`}
            stroke="#d7dce3"
            strokeWidth="1"
            opacity={0.34 - index * 0.012}
          />
        ))}
      </svg>
    </div>
  );
}

function KeyGraphic() {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-12 top-20 font-mono text-xs font-bold tracking-[0.18em] text-slate-400">
        <span className="mr-5 inline-block size-2 bg-[#f2c200]" />
        安全
        <div className="ml-7 mt-3 leading-7 text-slate-500">
          重置
          <br />
          连接
        </div>
      </div>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 560" fill="none" aria-hidden="true">
        <path d="M85 130v165h105" stroke="#cfd5dd" />
        <path d="M88 210h-46M85 295v142h142" stroke="#d8dde4" strokeDasharray="6 8" />
        <path d="M410 85v105M410 190h118v190" stroke="#d8dde4" strokeDasharray="7 10" />
        <path d="M214 335h-65M149 335v90h175" stroke="#d8dde4" strokeDasharray="5 12" />
        <circle cx="85" cy="210" r="3" stroke="#9098a3" />
        <circle cx="214" cy="335" r="3" stroke="#9098a3" />
        <circle cx="352" cy="452" r="3" stroke="#9098a3" />
        <circle cx="495" cy="315" r="3" stroke="#9098a3" />

        <path d="M355 158 470 225v134l-115 67-115-67V225l115-67Z" fill="#f8fafc" stroke="#9da5af" strokeWidth="1.5" />
        <path d="M355 182 449 236v111l-94 55-94-55V236l94-54Z" stroke="#f2c200" strokeWidth="3" />
        <path d="M355 216 419 253v76l-64 37-64-37v-76l64-37Z" stroke="#c2c8d0" />
        <circle cx="356" cy="263" r="24" fill="#f2c200" stroke="#d8a900" />
        <circle cx="356" cy="263" r="13" fill="#fbfbfa" stroke="#9da5af" />
        <path d="M356 286v72h18v-14h17v-18h-17v-16h24v-18h-42Z" fill="#f2c200" stroke="#d8a900" />
        <path d="M240 292h71M401 292h96M355 158v-65M355 426v86" stroke="#aeb6c0" />
        <path d="M240 225h-95M145 225v-58M470 225h76M546 225v-62" stroke="#d8dde4" strokeDasharray="6 9" />
        <path d="M245 217q-8 0-8 8v22M237 337v22q0 8 8 8M467 217q8 0 8 8v22M475 337v22q0 8-8 8" stroke="#f2c200" />
        <path d="M95 455h7M108 455h7M121 455h7" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" />
        <path d="M504 444h86v-45M590 444v-15" stroke="#d8dde4" />
        <path d="M512 482h70" stroke="#d8dde4" />
        <path d="M528 92v-11h11M528 490v11h11M92 490v11h11" stroke="#111827" strokeWidth="2" />
      </svg>

      <div className="absolute bottom-28 right-10 font-mono text-xs font-bold leading-7 tracking-[0.14em] text-slate-400">
        账号 · 邮箱 · 密码
        <br />
        安全找回
      </div>
    </div>
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

function InfoIcon() {
  return (
    <svg className="size-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MailBadgeIcon() {
  return (
    <svg className="size-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16v11H4z" stroke="currentColor" strokeWidth="1.7" />
      <path d="m5 8 7 6 7-6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="size-5 text-slate-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
