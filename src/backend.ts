import { treaty } from "@elysiajs/eden";
import type { App } from "@server/routes";
import errorMessages from "./errors";
const serverClient = treaty<App>(window.location.origin);
export default serverClient;

export function resolveErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const msg = (error as { value?: { err?: { msg?: string } } })?.value?.err
    ?.msg;
  if (msg && msg in errorMessages) {
    return errorMessages[msg] ?? "";
  }
  return fallback;
}

export function isApiError(data: unknown): data is { err: { status: number; msg: string } } {
  return (
    typeof data === "object" &&
    data !== null &&
    "err" in data &&
    typeof (data as { err?: unknown }).err === "object" &&
    (data as { err?: unknown }).err !== null
  );
}