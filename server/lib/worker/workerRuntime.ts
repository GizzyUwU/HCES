import { workerApp } from "@server/lib/workerApp";
import { logger } from "@server/lib/logger";
import * as Sentry from "@sentry/bun";

const workerLabels = new Map<string, string>();
let workerIdentity: { id: string; label: string; prefix: string } | null = null;

export function setWorkerLabel(id: string, label: string) {
  workerLabels.set(id, label);
}

export function getWorkerLabel(id: string): string | undefined {
  return workerLabels.get(id);
}

export type JobMessage = {
  type: "job";
  id: string;
  workerId: string;
  path: string;
  headers?: Record<string, string>;
};

export type HandleJobResult = {
  type: "result";
  id: string;
  status: number;
  data: unknown;
  bytes: number;
  headers: Record<string, string>;
};

export async function handleJob(msg: JobMessage, send: (data: string) => void) {
  try {
    const app = await workerApp();
    const scopedPath = msg.path.startsWith("/api/v1")
      ? msg.path.slice("/api/v1".length) || "/"
      : msg.path;
    const req = new Request("http://internal" + scopedPath, {
      headers: {
        ...(msg.headers ?? {}),
        "x-hces-worker-internal": "1",
        "x-hces-worker-id": msg.workerId,
      },
    });
    const res = await app.handle(req);
    const data = (await res.json().catch(() => null)) as HandleJobResult;
    const bytes = Buffer.byteLength(JSON.stringify(data ?? null), "utf-8");
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      if (key === "content-type" || key === "content-length") return;
      responseHeaders[key] = value;
    });
    send(
      JSON.stringify({
        type: "result",
        id: msg.id,
        status: res.status,
        data,
        bytes,
        headers:
          Object.keys(responseHeaders).length > 0 ? responseHeaders : undefined,
      }),
    );
  } catch (err) {
    logger.error("worker job failed", {
      path: msg.path,
      workerId: msg.workerId,
      workerLabel: workerLabels.get(msg.workerId),
      error: err,
    });
    send(
      JSON.stringify({
        type: "result",
        id: msg.id,
        status: 500,
        data: {
          err: "internal_server_error",
        },
      }),
    );
  }
}

export function startRemoteWorker({
  url,
  secret,
  version,
}: {
  url: string;
  secret: string;
  version: string;
}) {
  let reconnectDelay = 1000;
  const connect = () => {
    const socket = new WebSocket(`${url.replace(/\/$/, "")}/api/workers`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(version ? { "X-Worker-Version": version } : {}),
      },
    } as unknown as ConstructorParameters<typeof WebSocket>[1]);
    socket.addEventListener("open", () => {
      logger.info("connected to orchestrator", {
        url,
      });
      reconnectDelay = 1000;
    });

    socket.addEventListener("message", (event) => {
      let msg: JobMessage | { type: "i_want_to" } | {
        type: "welcome";
        worker: { id: string; label: string; prefix: string };
      };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (msg.type === "i_want_to") {
        socket.send(JSON.stringify({ type: "_cheese" }));
        return;
      }
      if (msg.type === "welcome") {
        workerIdentity = msg.worker;
        setWorkerLabel(msg.worker.id, msg.worker.label);
        Sentry.setTag("worker_id", msg.worker.id);
        Sentry.setTag("worker_label", msg.worker.label);
        Sentry.setTag("worker_prefix", msg.worker.prefix);
        Sentry.setTag("node_role", "remote_worker");
        logger.info("worker identity received", msg.worker);
        void Sentry.flush(1000);
        return;
      }
      if (msg.type !== "job") return;
      void handleJob(msg, (data) => socket.send(data));
    });

    socket.addEventListener("close", (event) => {
      const closeEvent = event as CloseEvent;
      logger.warn("worker websocket closed, reconnecting", {
        url,
        reconnectDelay,
        code: closeEvent.code,
        reason: closeEvent.reason,
        wasClean: closeEvent.wasClean,
        workerId: workerIdentity?.id,
        workerLabel: workerIdentity?.label,
      });
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30 * 1000);
    });

    socket.addEventListener("error", (event) => {
      const error = (event as ErrorEvent)?.error ?? null;
      logger.error("worker websocket error", {
        error: error instanceof Error ? error : undefined,
        url,
        reconnectDelay,
        readyState: socket.readyState,
        workerId: workerIdentity?.id,
        workerLabel: workerIdentity?.label,
      });
    });
  };

  connect();
}
