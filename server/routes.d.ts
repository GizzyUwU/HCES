import type {
  Elysia,
  SingletonBase,
  DefinitionBase,
  MetadataBase,
} from "elysia";

import Route0 from "./routes/[...].ts";
import Route1 from "./routes/index.ts";
import Route2 from "./routes/api/v1/(authed).ts";
import Route3 from "./routes/api/v1/web/(hcaAuthed).ts";
import Route4 from "./routes/api/v1/web/login/getOUT.ts";
import Route5 from "./routes/api/v1/web/login/getRedirectUrl.ts";
import Route6 from "./routes/api/v1/web/login/sessionCheck.ts";
import Route7 from "./routes/api/v1/web/(hcaAuthed)/account.ts";
import Route8 from "./routes/api/v1/web/(hcaAuthed)/apiKeys.ts";
import Route9 from "./routes/api/v1/web/(hcaAuthed)/workers.ts";
import Route10 from "./routes/api/v1/(authed)/me.ts";
import Route11 from "./routes/api/v1/(authed)/stardance/(cookieProvided).ts";
import Route12 from "./routes/api/v1/(authed)/stardance/shop/[id].ts";
import Route13 from "./routes/api/v1/(authed)/stardance/shop/index.ts";
import Route14 from "./routes/api/v1/(authed)/stardance/projects/[id]/index.ts";
import Route15 from "./routes/api/v1/(authed)/stardance/projects/[id]/devlogs/[devlogId].ts";
import Route16 from "./routes/api/v1/(authed)/stardance/projects/[id]/devlogs/index.ts";
import Route17 from "./routes/api/v1/(authed)/stardance/compat/shop/[id].ts";
import Route18 from "./routes/api/v1/(authed)/stardance/compat/shop/index.ts";
import Route19 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/index.ts";
import Route20 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/devlogs/[devlogId].ts";
import Route21 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/devlogs/index.ts";
import Route22 from "./routes/api/v1/(authed)/stardance/(cookieProvided)/goiStats.ts";
import Route23 from "./routes/api/v1/(authed)/flavortown/(keyAuth).ts";
import Route24 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/users/index.ts";
import Route25 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/users/[id]/index.ts";
import Route26 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/users/[id]/projects.ts";
import Route27 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/shop/[id].ts";
import Route28 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/shop/index.ts";
import Route29 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/shop/[id].ts";
import Route30 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/shop/index.ts";
import Route31 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/[id]/index.ts";
import Route32 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/[id]/devlogs/index.ts";
import Route33 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/devlogs/[id].ts";
import Route34 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/devlogs/index.ts";
import Route35 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/shop/[id].ts";
import Route36 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/shop/index.ts";
import Route37 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/projects/[id]/index.ts";
import Route38 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/projects/[id]/devlogs/[devlogId].ts";
import Route39 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/projects/[id]/devlogs/index.ts";

export type App = Elysia<
  string,
  SingletonBase,
  DefinitionBase,
  MetadataBase,
  (typeof Route1)["~Routes"] & {
    "*": (typeof Route0)["~Routes"];
    api: {
      v1: (typeof Route2)["~Routes"] & {
        me: (typeof Route10)["~Routes"];
        stardance: (typeof Route11)["~Routes"] & {
          goiStats: (typeof Route22)["~Routes"];
        } & {
          shop: (typeof Route13)["~Routes"] & {
            ":id": (typeof Route12)["~Routes"];
          };
          projects: {
            ":id": (typeof Route14)["~Routes"] & {
              devlogs: (typeof Route16)["~Routes"] & {
                ":devlogId": (typeof Route15)["~Routes"];
              };
            };
          };
          compat: {
            shop: (typeof Route18)["~Routes"] & {
              ":id": (typeof Route17)["~Routes"];
            };
            projects: {
              ":id": (typeof Route19)["~Routes"] & {
                devlogs: (typeof Route21)["~Routes"] & {
                  ":devlogId": (typeof Route20)["~Routes"];
                };
              };
            };
          };
        };
        flavortown: (typeof Route23)["~Routes"] & {
          users: (typeof Route24)["~Routes"] & {
            ":id": (typeof Route25)["~Routes"] & {
              projects: (typeof Route26)["~Routes"];
            };
          };
          shop: (typeof Route28)["~Routes"] & {
            ":id": (typeof Route27)["~Routes"];
          };
          projects: {
            shop: (typeof Route30)["~Routes"] & {
              ":id": (typeof Route29)["~Routes"];
            };
            ":id": (typeof Route31)["~Routes"] & {
              devlogs: (typeof Route32)["~Routes"];
            };
          };
          devlogs: (typeof Route34)["~Routes"] & {
            ":id": (typeof Route33)["~Routes"];
          };
          compat: {
            shop: (typeof Route36)["~Routes"] & {
              ":id": (typeof Route35)["~Routes"];
            };
            projects: {
              ":id": (typeof Route37)["~Routes"] & {
                devlogs: (typeof Route39)["~Routes"] & {
                  ":devlogId": (typeof Route38)["~Routes"];
                };
              };
            };
          };
        } & {};
      } & {
        web: (typeof Route3)["~Routes"] & {
          account: (typeof Route7)["~Routes"];
          apiKeys: (typeof Route8)["~Routes"];
          workers: (typeof Route9)["~Routes"];
        } & {
          login: {
            getOUT: (typeof Route4)["~Routes"];
            getRedirectUrl: (typeof Route5)["~Routes"];
            sessionCheck: (typeof Route6)["~Routes"];
          };
        };
      };
    };
  }
>;
