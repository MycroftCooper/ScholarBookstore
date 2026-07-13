"use client";

import { useEffect } from "react";
import NextError from "next/error";
import { reportClientError } from "@/lib/error-logs";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    reportClientError({
      message: error.message,
      stack: error.stack,
      metadata: {
        kind: "global-error",
        digest: error.digest ?? "",
      },
    });
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
