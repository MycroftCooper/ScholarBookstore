import Link from "next/link";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/domain", label: "领域" },
  { href: "/discover", label: "发现" },
];

const suggestions = [
  {
    title: "浏览文章",
    description: "探索游戏研发与创作经验",
    href: "/discover",
    icon: "article",
  },
  {
    title: "按领域查看",
    description: "发现感兴趣的知识领域",
    href: "/domain",
    icon: "stack",
  },
  {
    title: "去发现",
    description: "查看更多优质内容",
    href: "/discover?sort=hot",
    icon: "compass",
  },
  {
    title: "投递文章",
    description: "分享你的研究与实践",
    href: "/me/submit",
    icon: "write",
  },
];

export default function NotFound() {
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

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-28 pt-12 lg:grid-cols-[minmax(0,560px)_1fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-20">
          <section className="max-w-2xl">
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              // 404 - Page Not Found
            </p>
            <h1 className="mt-8 text-[8rem] font-black leading-none tracking-tight text-[#111318] sm:text-[10rem]">
              404
            </h1>
            <h2 className="mt-4 text-5xl font-black leading-tight tracking-tight sm:text-6xl">
              页面<span className="text-[#f2c200]">走丢</span>了
            </h2>
            <p className="mt-5 text-lg font-semibold leading-8 text-slate-500">
              你访问的页面可能已被移动、删除，或链接输入有误。
            </p>

            <form
              action="/discover"
              method="get"
              className="mt-8 flex h-14 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)] focus-within:border-[#f2c200] focus-within:ring-4 focus-within:ring-[#f2c200]/15"
            >
              <label className="flex min-w-0 flex-1 items-center px-4">
                <SearchIcon />
                <input
                  name="q"
                  placeholder="搜索文章、领域或标签..."
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-[#171b22] outline-none placeholder:text-slate-400"
                />
              </label>
              <span className="my-auto mr-2 hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-bold text-slate-500 sm:inline">
                ⌘ K
              </span>
              <button
                type="submit"
                className="my-2 mr-2 rounded-md bg-[#f2c200] px-4 text-sm font-black text-[#171717] transition hover:bg-[#ffd426]"
              >
                搜索
              </button>
            </form>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Link
                href="/"
                className="relative h-16 overflow-hidden rounded-lg bg-[#f2c200] px-6 text-lg font-black text-[#171717] shadow-[0_18px_38px_rgba(242,194,0,0.25)] transition hover:bg-[#ffd426]"
              >
                <span className="relative z-10 flex h-full items-center justify-center gap-8">
                  返回首页
                  <span className="text-3xl leading-none">→</span>
                </span>
                <span className="pointer-events-none absolute inset-x-2 bottom-2 top-2 rounded border border-white/55 opacity-70" />
              </Link>
              <Link
                href="/discover"
                className="flex h-16 items-center justify-center gap-8 rounded-lg border border-slate-200 bg-white px-6 text-lg font-black text-[#171b22] transition hover:border-[#f2c200] hover:bg-[#fff9d9]"
              >
                去发现
                <span className="text-3xl leading-none">→</span>
              </Link>
            </div>

            <section className="mt-10">
              <div className="mb-5 flex items-center gap-3 text-base font-black">
                <span className="size-2 bg-[#f2c200]" />
                你可以试试
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {suggestions.map((item) => (
                  <Link
                    key={`${item.href}-${item.title}`}
                    href={item.href}
                    className="group border-r border-slate-200 pr-4 last:border-r-0"
                  >
                    <span className="mb-4 grid size-10 place-items-center rounded-full border border-slate-200 text-[#171b22] transition group-hover:border-[#f2c200] group-hover:bg-[#fff9d9]">
                      <SuggestionIcon type={item.icon} />
                    </span>
                    <span className="block text-sm font-black text-[#171b22]">
                      {item.title}
                    </span>
                    <span className="mt-2 block text-xs font-semibold leading-5 text-slate-400">
                      {item.description}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </section>

          <section className="relative hidden min-h-[620px] lg:block" aria-label="404 页面走丢装饰图形">
            <LostPathGraphic />
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
    <div className="pointer-events-none absolute left-8 top-8 hidden h-[86%] flex-col items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 xl:flex">
      <span className="h-10 w-px border-l border-dashed border-slate-300" />
      <span className="size-2 bg-[#f2c200]" />
      <span className="h-56 w-px bg-slate-200" />
      <span className="size-2 bg-[#f2c200]" />
      <span className="size-2 bg-[#f2c200]" />
      <span className="h-40 w-px border-l border-dashed border-slate-300" />
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

function LostPathGraphic() {
  return (
    <div className="absolute inset-0">
      <div className="absolute right-10 top-32 text-xs font-bold leading-7 tracking-[0.18em] text-slate-400">
        <span className="mr-5 inline-block size-2 bg-[#f2c200]" />
        路径丢失
        <br />
        <span className="ml-7">24.0578° N</span>
        <br />
        <span className="ml-7">121.5198° E</span>
      </div>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 680 620" fill="none" aria-hidden="true">
        <path d="M88 514h56v-65h90M514 90v120h94M94 220h120M214 220v188h-78" stroke="#d8dde4" strokeDasharray="7 10" />
        <path d="M136 485h118M254 485v-65h94M474 405h118v-90M592 315v-55" stroke="#d8dde4" />
        <circle cx="214" cy="220" r="4" stroke="#111827" />
        <circle cx="254" cy="485" r="4" stroke="#111827" />
        <circle cx="592" cy="315" r="4" stroke="#111827" />
        <circle cx="514" cy="210" r="4" stroke="#111827" />

        <path d="M343 172 452 234 343 296 234 234l109-62Z" fill="#ffffff" stroke="#9098a3" />
        <path d="M234 234v105l109 62 109-62V234" fill="#f8fafc" />
        <path d="M234 234v105l109 62 109-62V234M343 296v105" stroke="#111827" />
        <path d="M343 172v124M234 234l109 62 109-62" stroke="#9098a3" />
        <path d="M343 215 396 245 343 275 290 245l53-30Z" stroke="#d8a900" strokeWidth="2" />
        <path d="M343 215v60l53-30-53-30Z" fill="#f2c200" />

        <path d="M343 430 520 528 343 626 166 528l177-98Z" stroke="#9da5af" />
        <path d="M343 396 552 512 343 628 134 512l209-116Z" stroke="#cfd5dd" />
        <path d="M343 360 584 496 343 632 102 496l241-136Z" stroke="#d8dde4" />
        <path d="M343 442 438 494 343 547 248 494l95-52Z" fill="#aeb4bc" opacity="0.55" />
        <path d="M343 463 400 494 343 526 286 494l57-31Z" fill="#656b73" opacity="0.75" />
        <path d="m318 481 50 28M368 481l-50 28" stroke="#f2c200" strokeWidth="3" strokeLinecap="round" />

        <path d="M90 460h-34v-70M586 104h24v24M180 560v34h34M565 560h34v-34" stroke="#111827" strokeWidth="2" />
        <path d="M150 336h80M230 336v-98M453 338h92M545 338v-88M343 172v-80M343 401v96" stroke="#aeb6c0" />
        <path d="M204 152h8M220 152h8M236 152h8M492 452h8M508 452h8M524 452h8" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
        <path d="M498 550h100v-48M598 550v-15" stroke="#d8dde4" />
        <path d="M506 586h74" stroke="#d8dde4" />
        <path d="M94 96v-16h16M620 88v-16h16M620 560v16h16" stroke="#111827" strokeWidth="2" />
      </svg>

      <div className="absolute bottom-20 right-10 font-mono text-xs font-bold leading-7 tracking-[0.14em] text-slate-400">
        文章 · 版块 · 发现
        <br />
        回到知识路径
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="size-5 shrink-0 text-[#171b22]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SuggestionIcon({ type }: { type: string }) {
  if (type === "stack") {
    return (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m12 4 8 4-8 4-8-4 8-4Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="m4 12 8 4 8-4M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === "compass") {
    return (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="m15 9-2 6-4 2 2-6 4-2Z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === "write") {
    return (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 19h14M7 16l8.5-8.5 2 2L9 18H7v-2Z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4h12v16H6z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
