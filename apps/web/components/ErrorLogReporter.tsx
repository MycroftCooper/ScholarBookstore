"use client";

import { useEffect } from "react";
import { errorToLogInput, reportClientError } from "@/lib/error-logs";

export function ErrorLogReporter() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reportClientError({
        ...errorToLogInput(event.error ?? event.message),
        metadata: {
          filename: event.filename,
          lineno: String(event.lineno),
          colno: String(event.colno),
        },
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      reportClientError({
        ...errorToLogInput(event.reason),
        metadata: {
          kind: "unhandledrejection",
        },
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
