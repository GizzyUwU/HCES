import Elysia from "elysia";
import pkg from "@root/package.json";
import { requestID } from "elysia-requestid";
import zlib from "node:zlib";
const encoder = new TextEncoder();

export default new Elysia()
  .mapResponse(({ responseValue, headers, set }) => {
    const isJson = typeof responseValue === "object";
    const text = isJson
      ? JSON.stringify(responseValue)
      : (responseValue?.toString() ?? "");
    const contentType = `${isJson ? "application/json" : "text/plain"}; charset=utf-8`;
    const acceptEncoding = headers["accept-encoding"] ?? "";
    const body = encoder.encode(text);
  
    const outHeaders = new Headers(set.headers as HeadersInit);
    outHeaders.set("Content-Type", contentType);
  
    if (acceptEncoding.includes("br")) {
      outHeaders.set("Content-Encoding", "br");
      return new Response(zlib.brotliCompressSync(body), { headers: outHeaders });
    }
    if (acceptEncoding.includes("gzip")) {
      outHeaders.set("Content-Encoding", "gzip");
      return new Response(zlib.gzipSync(body), { headers: outHeaders });
    }
    return new Response(body, { headers: outHeaders });
  })
  .use(requestID({
    uuid: crypto.randomUUID.bind(crypto),
    header: "X-Request-ID"
  }))
  .get("", () => ({
    name: pkg.name,
    version: pkg.version,
  }));
