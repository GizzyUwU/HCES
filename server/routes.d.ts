import type {
  Elysia,
  SingletonBase,
  DefinitionBase,
  MetadataBase,
} from "elysia";

import Route0 from "./routes/index.ts";
import Route1 from "./routes/[...].ts";
import Route2 from "./routes/api/v1/(authed).ts";
import Route3 from "./routes/api/v1/(authed)/me.ts";
import Route4 from "./routes/api/v1/web/(hcaAuthed).ts";
import Route5 from "./routes/api/v1/web/login/getRedirectUrl.ts";
import Route6 from "./routes/api/v1/web/login/sessionCheck.ts";
import Route7 from "./routes/api/v1/web/login/getOUT.ts";
import Route8 from "./routes/api/v1/web/(hcaAuthed)/apiKeys.ts";
import Route9 from "./routes/api/v1/web/(hcaAuthed)/account.ts";

export type App = Elysia<
  string,
  SingletonBase,
  DefinitionBase,
  MetadataBase,
  (typeof Route0)["~Routes"] & {
    "*": (typeof Route1)["~Routes"];
    api: {
      v1: (typeof Route2)["~Routes"] & {
        me: (typeof Route3)["~Routes"];
      } & {
        web: (typeof Route4)["~Routes"] & {
          apiKeys: (typeof Route8)["~Routes"];
          account: (typeof Route9)["~Routes"];
        } & {
          login: {
            getRedirectUrl: (typeof Route5)["~Routes"];
            sessionCheck: (typeof Route6)["~Routes"];
            getOUT: (typeof Route7)["~Routes"];
          };
        };
      };
    };
  }
>;
