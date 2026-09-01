import { workerApp } from "@server/lib/workerApp";
import { logger } from "@server/lib/utils";
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
      let msg: JobMessage | { type: "i_want_to" };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (msg.type === "i_want_to") {
        socket.send(JSON.stringify({ type: "_cheese" }));
        return;
      }
      if (msg.type !== "job") return;
      void handleJob(msg, (data) => socket.send(data));
    });

    socket.addEventListener("close", () => {
      logger.warn("uhm i disconnected from orchestrator ill try to reconnect", {
        in: reconnectDelay,
      });
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30 * 1000);
    });

    socket.addEventListener("error", (err) => {
      logger.error("socket error", { error: err });
    });
  };

  connect();
}
