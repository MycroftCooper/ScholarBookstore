"use client";

import { useParams } from "next/navigation";
import { DomainDetailShowcase } from "@/components/domain/DomainDetailShowcase";

export default function DomainDetailPage() {
  const params = useParams<{ id: string }>();

  return <DomainDetailShowcase id={params?.id ?? ""} />;
}
