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
import Route5 from "./routes/api/v1/(authed)/stardance/projects/[id]/index.ts";
import Route6 from "./routes/api/v1/(authed)/stardance/projects/[id]/devlogs/index.ts";
import Route7 from "./routes/api/v1/(authed)/stardance/projects/[id]/devlogs/[devlogId].ts";
import Route8 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/index.ts";
import Route9 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/devlogs/index.ts";
import Route10 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/devlogs/[devlogId].ts";
import Route11 from "./routes/api/v1/(authed)/stardance/(cookieProvided)/goiStats.ts";
import Route12 from "./routes/api/v1/web/(hcaAuthed).ts";
import Route13 from "./routes/api/v1/web/login/getRedirectUrl.ts";
import Route14 from "./routes/api/v1/web/login/sessionCheck.ts";
import Route15 from "./routes/api/v1/web/login/getOUT.ts";
import Route16 from "./routes/api/v1/web/(hcaAuthed)/apiKeys.ts";
import Route17 from "./routes/api/v1/web/(hcaAuthed)/account.ts";
import Route18 from "./routes/api/v1/web/(hcaAuthed)/workers.ts";

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
          goiStats: (typeof Route11)["~Routes"];
        } & {
          projects: {
            ":id": (typeof Route5)["~Routes"] & {
              devlogs: (typeof Route6)["~Routes"] & {
                ":devlogId": (typeof Route7)["~Routes"];
              };
            };
          };
          compat: {
            projects: {
              ":id": (typeof Route8)["~Routes"] & {
                devlogs: (typeof Route9)["~Routes"] & {
                  ":devlogId": (typeof Route10)["~Routes"];
                };
              };
            };
          };
        };
      } & {
        web: (typeof Route12)["~Routes"] & {
          apiKeys: (typeof Route16)["~Routes"];
          account: (typeof Route17)["~Routes"];
          workers: (typeof Route18)["~Routes"];
        } & {
          login: {
            getRedirectUrl: (typeof Route13)["~Routes"];
            sessionCheck: (typeof Route14)["~Routes"];
            getOUT: (typeof Route15)["~Routes"];
          };
        };
      };
    };
  }
>;
