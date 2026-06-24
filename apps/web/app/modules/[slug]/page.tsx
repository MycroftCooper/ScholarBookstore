"use client";

import { useParams } from "next/navigation";
import { ModuleShowcase } from "@/components/modules/ModuleShowcase";

export default function ModuleDetailPage() {
  const params = useParams<{ slug: string }>();

  return <ModuleShowcase slug={params.slug} />;
}
