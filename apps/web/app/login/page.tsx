import Link from "next/link";
import { AuthForm } from "@/components/forms/AuthForm";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "首页" },
  { href: "/domain", label: "领域" },
  { href: "/discover", label: "发现" },
];

export default function LoginPage() {
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

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-28 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,620px)_1fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-20">
          <div className="rounded-[20px] border border-slate-200/80 bg-white/[0.92] p-4 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur">
            <AuthForm mode="login" variant="tech" />
          </div>

          <section className="relative hidden min-h-[560px] lg:block" aria-label="游学书屋装饰图形">
            <BookstoreGraphic />
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

function BookstoreGraphic() {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-12 top-20 font-mono text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        <span className="mr-5 inline-block size-2 bg-[#f2c200]" />
        游学书屋
        <div className="ml-7 mt-3 text-slate-500">阅读 / 投稿 / 审核</div>
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
        <path d="M355 198 468 263v130l-113 65-113-65V263l113-65Z" stroke="#9da5af" strokeWidth="1.5" />
        <path d="M355 221 448 275v106l-93 54-93-54V275l93-54Z" stroke="#c2c8d0" />
        <path d="M355 255 419 292v74l-64 37-64-37v-74l64-37Z" stroke="#f2c200" strokeWidth="1.6" />
        <path d="M355 295 390 315v40l-35 20-35-20v-40l35-20Z" stroke="#adb4bd" />
        <path d="M355 298v77M322 316l33 19 33-19M355 335v39" stroke="#ffffff" strokeWidth="1.5" />
        <path d="M355 282 380 296v28l-25 15-25-15v-28l25-14Z" fill="#f2c200" />
        <path d="m330 296 25 15 25-15M355 311v28" stroke="#ffffff" strokeWidth="1.4" />
        <path d="M242 342h44M424 342h70M355 198v-44M355 458v55" stroke="#aeb6c0" />
        <path d="M286 342h-31v-62M424 342h40v-55" stroke="#aeb6c0" />
        <path d="M242 263v84M468 263v84" stroke="#cfd5dd" strokeDasharray="8 10" />
        <path d="M245 255q-8 0-8 8v22M237 374v22q0 8 8 8M465 255q8 0 8 8v22M473 374v22q0 8-8 8" stroke="#f2c200" />
        <path d="M95 455h7M108 455h7M121 455h7" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" />
        <path d="M504 444h86v-45M590 444v-15" stroke="#d8dde4" />
        <path d="M512 482h70" stroke="#d8dde4" />
        <path d="M528 92v-11h11M528 490v11h11M92 490v11h11" stroke="#111827" strokeWidth="2" />
      </svg>

      <div className="absolute bottom-28 right-10 font-mono text-xs font-bold uppercase leading-7 tracking-[0.14em] text-slate-400">
        文章 · 版块 · 评论
        <br />
        在游戏中学习
      </div>
    </div>
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
