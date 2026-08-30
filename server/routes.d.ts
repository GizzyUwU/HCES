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
import Route4 from "./routes/api/v1/(authed)/flavortown/(keyAuth).ts";
import Route5 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/shop/index.ts";
import Route6 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/shop/[id].ts";
import Route7 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/shop/index.ts";
import Route8 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/shop/[id].ts";
import Route9 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/projects/[id]/index.ts";
import Route10 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/projects/[id]/devlogs/index.ts";
import Route11 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/projects/[id]/devlogs/[devlogId].ts";
import Route12 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/users/index.ts";
import Route13 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/users/[id]/index.ts";
import Route14 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/users/[id]/projects.ts";
import Route15 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/devlogs/[id].ts";
import Route16 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/devlogs/index.ts";
import Route17 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/shop/index.ts";
import Route18 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/shop/[id].ts";
import Route19 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/[id]/index.ts";
import Route20 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/[id]/devlogs/index.ts";
import Route21 from "./routes/api/v1/(authed)/stardance/(cookieProvided).ts";
import Route22 from "./routes/api/v1/(authed)/stardance/shop/index.ts";
import Route23 from "./routes/api/v1/(authed)/stardance/shop/[id].ts";
import Route24 from "./routes/api/v1/(authed)/stardance/projects/[id]/index.ts";
import Route25 from "./routes/api/v1/(authed)/stardance/projects/[id]/devlogs/index.ts";
import Route26 from "./routes/api/v1/(authed)/stardance/projects/[id]/devlogs/[devlogId].ts";
import Route27 from "./routes/api/v1/(authed)/stardance/compat/shop/index.ts";
import Route28 from "./routes/api/v1/(authed)/stardance/compat/shop/[id].ts";
import Route29 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/index.ts";
import Route30 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/devlogs/index.ts";
import Route31 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/devlogs/[devlogId].ts";
import Route32 from "./routes/api/v1/(authed)/stardance/(cookieProvided)/goiStats.ts";
import Route33 from "./routes/api/v1/web/(hcaAuthed).ts";
import Route34 from "./routes/api/v1/web/login/getRedirectUrl.ts";
import Route35 from "./routes/api/v1/web/login/sessionCheck.ts";
import Route36 from "./routes/api/v1/web/login/getOUT.ts";
import Route37 from "./routes/api/v1/web/(hcaAuthed)/apiKeys.ts";
import Route38 from "./routes/api/v1/web/(hcaAuthed)/account.ts";
import Route39 from "./routes/api/v1/web/(hcaAuthed)/workers.ts";

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
        flavortown: (typeof Route4)["~Routes"] & {
          shop: (typeof Route5)["~Routes"] & {
            ":id": (typeof Route6)["~Routes"];
          };
          compat: {
            shop: (typeof Route7)["~Routes"] & {
              ":id": (typeof Route8)["~Routes"];
            };
            projects: {
              ":id": (typeof Route9)["~Routes"] & {
                devlogs: (typeof Route10)["~Routes"] & {
                  ":devlogId": (typeof Route11)["~Routes"];
                };
              };
            };
          };
          users: (typeof Route12)["~Routes"] & {
            ":id": (typeof Route13)["~Routes"] & {
              projects: (typeof Route14)["~Routes"];
            };
          };
          devlogs: (typeof Route16)["~Routes"] & {
            ":id": (typeof Route15)["~Routes"];
          };
          projects: {
            shop: (typeof Route17)["~Routes"] & {
              ":id": (typeof Route18)["~Routes"];
            };
            ":id": (typeof Route19)["~Routes"] & {
              devlogs: (typeof Route20)["~Routes"];
            };
          };
        } & {};
        stardance: (typeof Route21)["~Routes"] & {
          goiStats: (typeof Route32)["~Routes"];
        } & {
          shop: (typeof Route22)["~Routes"] & {
            ":id": (typeof Route23)["~Routes"];
          };
          projects: {
            ":id": (typeof Route24)["~Routes"] & {
              devlogs: (typeof Route25)["~Routes"] & {
                ":devlogId": (typeof Route26)["~Routes"];
              };
            };
          };
          compat: {
            shop: (typeof Route27)["~Routes"] & {
              ":id": (typeof Route28)["~Routes"];
            };
            projects: {
              ":id": (typeof Route29)["~Routes"] & {
                devlogs: (typeof Route30)["~Routes"] & {
                  ":devlogId": (typeof Route31)["~Routes"];
                };
              };
            };
          };
        };
      } & {
        web: (typeof Route33)["~Routes"] & {
          apiKeys: (typeof Route37)["~Routes"];
          account: (typeof Route38)["~Routes"];
          workers: (typeof Route39)["~Routes"];
        } & {
          login: {
            getRedirectUrl: (typeof Route34)["~Routes"];
            sessionCheck: (typeof Route35)["~Routes"];
            getOUT: (typeof Route36)["~Routes"];
          };
        };
      };
    };
  }
>;
