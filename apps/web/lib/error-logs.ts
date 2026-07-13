const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

type ClientErrorLogInput = {
  message: string;
  stack?: string;
  level?: "error" | "warning" | "info";
  path?: string;
  componentStack?: string;
  metadata?: Record<string, string>;
};

export function reportClientError(input: ClientErrorLogInput) {
  if (typeof window === "undefined") {
    return;
  }

  const message = input.message.trim();
  if (!message) {
    return;
  }

  void fetch(`${API_BASE_URL}/client-logs/errors`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      level: input.level ?? "error",
      message,
      stack: input.stack ?? "",
      path: input.path ?? window.location.pathname,
      componentStack: input.componentStack ?? "",
      metadata: {
        href: window.location.href,
        ...input.metadata,
      },
    }),
  }).catch(() => {
    // Logging must never break the user-facing page.
  });
}

export function errorToLogInput(error: unknown): ClientErrorLogInput {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    message: typeof error === "string" ? error : "Unknown client error",
    stack: safeStringify(error),
  };
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
