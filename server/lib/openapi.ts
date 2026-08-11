import { toOpenAPISchema } from "@elysia/openapi";
import type { OpenAPIV3 } from "openapi-types";

export function getPublicOpenApiSpec(
  app: Parameters<typeof toOpenAPISchema>[0],
) {
  const { paths, components } = toOpenAPISchema(app);

  return {
    openapi: "3.0.3",
    info: {
      title: "HCES - API Docs",
      version: "v1",
    },
    security: [{ "Header": [] }],
    servers: [
      { url: "https://hces.gizzy.gay" },
    ],
    paths: Object.fromEntries(
      Object.entries(paths).filter(
        ([path]) => path.startsWith("/api/v1") && !path.startsWith("/api/v1/web"),
      ),
    ),
    components: {
      ...components,
      securitySchemes: {
        "Header": {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  } satisfies OpenAPIV3.Document;
}