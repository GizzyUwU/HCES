import type {
  Elysia,
  SingletonBase,
  DefinitionBase,
  MetadataBase,
} from "elysia";

import Route0 from "./routes/index.ts";
import Route1 from "./routes/api/v1/web/(hcaAuthed).ts";
import Route2 from "./routes/api/v1/web/login/getRedirectUrl.ts";
import Route3 from "./routes/api/v1/web/login/sessionCheck.ts";

export type App = Elysia<
  string,
  SingletonBase,
  DefinitionBase,
  MetadataBase,
  (typeof Route0)["~Routes"] & {
    api: {
      v1: {
        web: (typeof Route1)["~Routes"] & {
          login: {
            getRedirectUrl: (typeof Route2)["~Routes"];
            sessionCheck: (typeof Route3)["~Routes"];
          };
        };
      };
    };
  }
>;
