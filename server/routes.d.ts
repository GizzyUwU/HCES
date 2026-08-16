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
import Route4 from "./routes/api/v1/(authed)/stardance/(cookieProvided).ts";
import Route5 from "./routes/api/v1/(authed)/stardance/(cookieProvided)/goiStats.ts";
import Route6 from "./routes/api/v1/web/(hcaAuthed).ts";
import Route7 from "./routes/api/v1/web/login/getRedirectUrl.ts";
import Route8 from "./routes/api/v1/web/login/sessionCheck.ts";
import Route9 from "./routes/api/v1/web/login/getOUT.ts";
import Route10 from "./routes/api/v1/web/(hcaAuthed)/apiKeys.ts";
import Route11 from "./routes/api/v1/web/(hcaAuthed)/account.ts";
import Route12 from "./routes/api/v1/web/(hcaAuthed)/workers.ts";

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
        stardance: (typeof Route4)["~Routes"] & {
          goiStats: (typeof Route5)["~Routes"];
        } & {};
      } & {
        web: (typeof Route6)["~Routes"] & {
          apiKeys: (typeof Route10)["~Routes"];
          account: (typeof Route11)["~Routes"];
          workers: (typeof Route12)["~Routes"];
        } & {
          login: {
            getRedirectUrl: (typeof Route7)["~Routes"];
            sessionCheck: (typeof Route8)["~Routes"];
            getOUT: (typeof Route9)["~Routes"];
          };
        };
      };
    };
  }
>;
