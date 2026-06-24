import { ArticleDetailShowcase } from "@/components/articles/ArticleDetailShowcase";
import { SiteFrame } from "@/components/layout/SiteFrame";

type ArticleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { id } = await params;

  return (
    <SiteFrame>
      <ArticleDetailShowcase id={id} />
    </SiteFrame>
  );
}
