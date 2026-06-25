import Link from "next/link";
import { AuthForm } from "@/components/forms/AuthForm";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/domain", label: "领域" },
  { href: "/discover", label: "发现" },
];

export default function RegisterPage() {
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

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-28 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,620px)_1fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-14">
          <div className="rounded-[20px] border border-slate-200/80 bg-white/[0.92] p-4 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur">
            <AuthForm mode="register" variant="tech" />
          </div>

          <section className="relative hidden min-h-[620px] lg:block" aria-label="游学书屋装饰图形">
            <BookStackGraphic />
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

function BookStackGraphic() {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-12 top-20 font-mono text-xs font-bold tracking-[0.18em] text-slate-400">
        <span className="mr-5 inline-block size-2 bg-[#f2c200]" />
        游学书屋
        <div className="ml-7 mt-3 text-slate-500">阅读 / 投稿 / 审核</div>
      </div>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 620" fill="none" aria-hidden="true">
        <path d="M80 160v170h112" stroke="#cfd5dd" />
        <path d="M82 248h-44M80 330v164h160" stroke="#d8dde4" strokeDasharray="6 8" />
        <path d="M450 86v122M450 208h116v214" stroke="#d8dde4" strokeDasharray="7 10" />
        <path d="M210 388h-68M142 388v106h190" stroke="#d8dde4" strokeDasharray="5 12" />
        <circle cx="80" cy="248" r="3" stroke="#9098a3" />
        <circle cx="210" cy="388" r="3" stroke="#9098a3" />
        <circle cx="374" cy="498" r="3" stroke="#9098a3" />
        <circle cx="510" cy="360" r="3" stroke="#9098a3" />

        <path d="M350 292 488 365 350 438 212 365l138-73Z" fill="#eef1f4" stroke="#c7ced8" />
        <path d="M212 365v22l138 74 138-74v-22" fill="#e3e7ec" />
        <path d="M212 387 350 461 488 387" stroke="#c7ced8" />
        <path d="M350 250 496 328 350 405 204 328l146-78Z" fill="#f7f8f9" stroke="#c7ced8" />
        <path d="M204 328v24l146 78 146-78v-24" fill="#eef1f4" />
        <path d="M204 352 350 430 496 352" stroke="#c7ced8" />
        <path d="M350 210 506 292 350 374 194 292l156-82Z" fill="#ffffff" stroke="#aeb6c0" />
        <path d="M194 292v25l156 82 156-82v-25" fill="#f3f5f7" />
        <path d="M194 317 350 399 506 317" stroke="#c7ced8" />

        <path d="M350 166 438 213v72l-88 47-88-47v-72l88-47Z" fill="#f2c200" stroke="#ffd84d" />
        <path d="M350 189 414 224v48l-64 35-64-35v-48l64-35Z" stroke="#fff7c7" />
        <path d="M330 240h40M350 220v40M350 240l24-14M350 240l24 14" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M262 292h-62v-66M438 292h72v-72M350 166v-56M350 399v76" stroke="#aeb6c0" />
        <path d="M195 206q-8 0-8 8v24M187 350v24q0 8 8 8M505 208q8 0 8 8v24M513 356v24q0 8-8 8" stroke="#f2c200" />
        <path d="M97 510h7M110 510h7M123 510h7" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" />
        <path d="M508 514h84v-45M592 514v-15" stroke="#d8dde4" />
        <path d="M514 550h66" stroke="#d8dde4" />
        <path d="M538 102v-11h11M538 554v11h11M96 554v11h11" stroke="#111827" strokeWidth="2" />
      </svg>

      <div className="absolute bottom-24 right-10 font-mono text-xs font-bold leading-7 tracking-[0.14em] text-slate-400">
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
