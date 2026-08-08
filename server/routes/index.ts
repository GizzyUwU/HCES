import Elysia from "elysia";
import pkg from "@root/package.json";
import { requestID } from "elysia-requestid";
import zlib from "node:zlib";
const encoder = new TextEncoder();

export default new Elysia()
  .mapResponse(({ responseValue, headers }) => {
    const isJson = typeof responseValue === "object";
    const text = isJson
      ? JSON.stringify(responseValue)
      : (responseValue?.toString() ?? "");

    const contentType = `${isJson ? "application/json" : "text/plain"}; charset=utf-8`;
    const acceptEncoding = headers["accept-encoding"] ?? "";
    const body = encoder.encode(text);

    if (acceptEncoding.includes("br")) {
      return new Response(zlib.brotliCompressSync(body), {
        headers: {
          "Content-Type": contentType,
          "Content-Encoding": "br",
        },
      });
    }

    if (acceptEncoding.includes("gzip")) {
      return new Response(zlib.gzipSync(body), {
        headers: {
          "Content-Type": contentType,
          "Content-Encoding": "gzip",
        },
      });
    }

    return new Response(body, {
      headers: { "Content-Type": contentType },
    });
  })
  .use(requestID({
    uuid: crypto.randomUUID.bind(crypto),
    header: "X-Request-ID"
  }))
  .get("", () => ({
    name: pkg.name,
    version: pkg.version,
  }));
