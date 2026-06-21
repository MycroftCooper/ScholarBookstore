import Link from "next/link";
import { ArticleList } from "@/components/content/ArticleList";
import { DomainList } from "@/components/content/DomainList";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.05fr_0.95fr] md:py-16">
        <div className="flex min-h-[360px] flex-col justify-center">
          <p className="mb-3 text-sm font-medium text-brass">知识库社区</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-ink md:text-5xl">
            从领域进入版块，在文章里发现可靠的技术知识。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
            浏览公开领域，搜索已发布文章，或把你的技术笔记提交给审核队列。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/discover"
              className="rounded-md bg-moss px-5 py-3 text-sm font-medium text-white hover:bg-[#354f42]"
            >
              发现文章
            </Link>
            <Link
              href="/me/submit"
              className="rounded-md border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-800 hover:border-stone-400"
            >
              投稿
            </Link>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">领域</h2>
            <div className="mt-4">
              <DomainList />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-brass">最新文章</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">最近发布</h2>
          </div>
          <Link
            href="/discover?sort=latest"
            className="text-sm font-medium text-moss underline-offset-4 hover:underline"
          >
            查看更多
          </Link>
        </div>
        <ArticleList pageSize={8} />
      </section>
    </main>
  );
}
