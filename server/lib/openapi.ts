import { toOpenAPISchema } from "@elysia/openapi";
import type { OpenAPIV3 } from "openapi-types";

type ScalarOpenAPIDocument = OpenAPIV3.Document & {
  "x-tagGroups"?: {
    name: string;
    tags: string[];
  }[];
};

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
    security: [{ Header: [] }],
    servers: [{ url: "https://hces.gizzy.gay" }],
    paths: Object.fromEntries(
      Object.entries(paths).filter(
        ([path]) =>
          path.startsWith("/api/v1") &&
          !path.startsWith("/api/v1/web") &&
          !path.startsWith("/api/v1/docs") &&
          !path.startsWith("/api/v1/ws/docs"),
      ),
    ),
    components: {
      ...components,
      securitySchemes: {
        Header: {
          type: "http",
          scheme: "bearer",
        },
        StardanceCookie: {
          type: "apiKey",
          in: "header",
          name: "X-Stardance-Cookie",
        },
        FlavortownKey: {
          type: "apiKey",
          in: "header",
          name: "X-Flavortown-Key",
        },
      },
    },
    tags: [
      {
        name: "HCES",
        description: "All endpoints that are for HCES",
      },
      {
        name: "Generic",
        description: "Generic endpoints for HCES",
      },
      {
        name: "Compatability",
        description:
          "All endpoints that provide same schema of data no matter the scraper",
      },
      {
        name: "Stardance",
        description: "All endpoints that are for Stardance",
      },
      
      {
        name: "Stardance / Generic",
        description: "Stardance generic endpoints",
      },
      {
        name: "Stardance / Projects",
        description: "Stardance projects endpoints",
      },
      {
        name: "Stardance / Sho",
        description: "Stardance shop endpoints",
      },
      {
        name: "Flavortown",
        description: "All endpoints that are for Flavortown",
      },
      {
        name: "Flavortown / Devlogs",
        description: "Flavortown devlogs endpoints",
      },
      {
        name: "Flavortown / Projects",
        description: "Flavortown projects endpoints",
      },
      {
        name: "Flavortown / Shop",
        description: "Flavortown shop endpoints",
      },
      {
        name: "Flavortown / Users",
        description: "Flavortown users endpoints",
      },
    ],
    "x-tagGroups": [
      {
        name: "HCES",
        tags: [
          "Generic",
        ],
      },
      {
        name: "Compatability",
        tags: [
          "StardanceCP / Projects",
          "StardanceCP / Shop",
          "FlavortownCP / Projects",
          "FlavortownCP / Shop",
        ],
      },
      {
        name: "Stardance",
        tags: [
          "Stardance / Generic",
          "Stardance / Projects",
          "Stardance / Shop",
        ],
      },
      {
        name: "Flavortown",
        tags: [
          "Flavortown / Projects",
          "Flavortown / Devlogs",
          "Flavortown / Shop",
          "Flavortown / Users",
        ],
      },
    ],
  } satisfies ScalarOpenAPIDocument;
}
