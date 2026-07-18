const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccess<T> = {
  data: T;
  meta: Record<string, unknown>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const body = await requestApiBody<T>(path, options);
  return body.data;
}

export async function apiRequestWithMeta<T, M = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta: M }> {
  const body = await requestApiBody<T, M>(path, options);
  return { data: body.data, meta: body.meta };
}

async function requestApiBody<T, M = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<ApiSuccess<T> & { meta: M }> {
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers);
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as ApiSuccess<T> | ApiErrorBody) : null;
  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? "UNKNOWN_ERROR",
      errorBody?.error?.message ?? "\u8bf7\u6c42\u5931\u8d25",
    );
  }

  return body as ApiSuccess<T> & { meta: M };
}
