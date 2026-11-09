// Browser-side fetch helper that understands our { error: { code, message } } format.
export class ApiClientError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    throw new ApiClientError(data?.error?.code ?? "UNKNOWN", data?.error?.message ?? "Something went wrong. Please try again.", res.status);
  }
  return data as T;
}

export const postJson = <T,>(url: string, body: unknown) =>
  apiFetch<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
