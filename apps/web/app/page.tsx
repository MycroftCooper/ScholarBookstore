import Link from "next/link";
import { ModuleList } from "@/components/content/ModuleList";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.15fr_0.85fr] md:py-16">
        <div className="flex min-h-[360px] flex-col justify-center">
          <p className="mb-3 text-sm font-medium text-brass">知识库社区</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-ink md:text-5xl">
            沉淀技术文章，从一个清晰的入口开始。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
            当前版本先完成账户与个人中心闭环。版块、文章投稿、审核和评论会按阶段逐步接入。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/submit"
              className="rounded-md bg-moss px-5 py-3 text-sm font-medium text-white hover:bg-[#354f42]"
            >
              投稿
            </Link>
            <Link
              href="/me/articles"
              className="rounded-md border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-800 hover:border-stone-400"
            >
              我的投稿
            </Link>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">版块</h2>
            <div className="mt-4">
              <ModuleList />
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-ink">下一批能力</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              版块列表、文章投稿、审核后台、评论回复和通知会在认证闭环后继续实现。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
