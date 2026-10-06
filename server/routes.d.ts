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
import Route4 from "./routes/api/v1/(authed)/macondo/(auth).ts";
import Route5 from "./routes/api/v1/(authed)/macondo/(auth)/orders/index.ts";
import Route6 from "./routes/api/v1/(authed)/macondo/(auth)/projects/[id]/index.ts";
import Route7 from "./routes/api/v1/(authed)/macondo/(auth)/projects/[id]/journals/index.ts";
import Route8 from "./routes/api/v1/(authed)/macondo/(auth)/compat/projects/[id]/index.ts";
import Route9 from "./routes/api/v1/(authed)/macondo/(auth)/compat/projects/[id]/devlogs/[devlogId].ts";
import Route10 from "./routes/api/v1/(authed)/macondo/(auth)/compat/projects/[id]/devlogs/index.ts";
import Route11 from "./routes/api/v1/(authed)/flavortown/(keyAuth).ts";
import Route12 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/shop/[id].ts";
import Route13 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/shop/index.ts";
import Route14 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/shop/[id].ts";
import Route15 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/shop/index.ts";
import Route16 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/projects/[id]/index.ts";
import Route17 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/projects/[id]/devlogs/[devlogId].ts";
import Route18 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/compat/projects/[id]/devlogs/index.ts";
import Route19 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/users/index.ts";
import Route20 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/users/[id]/index.ts";
import Route21 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/users/[id]/projects.ts";
import Route22 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/devlogs/[id].ts";
import Route23 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/devlogs/index.ts";
import Route24 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/shop/[id].ts";
import Route25 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/shop/index.ts";
import Route26 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/[id]/index.ts";
import Route27 from "./routes/api/v1/(authed)/flavortown/(keyAuth)/projects/[id]/devlogs/index.ts";
import Route28 from "./routes/api/v1/(authed)/stardance/(cookieProvided).ts";
import Route29 from "./routes/api/v1/(authed)/stardance/shop/[id].ts";
import Route30 from "./routes/api/v1/(authed)/stardance/shop/index.ts";
import Route31 from "./routes/api/v1/(authed)/stardance/projects/[id]/index.ts";
import Route32 from "./routes/api/v1/(authed)/stardance/projects/[id]/devlogs/[devlogId].ts";
import Route33 from "./routes/api/v1/(authed)/stardance/projects/[id]/devlogs/index.ts";
import Route34 from "./routes/api/v1/(authed)/stardance/compat/shop/[id].ts";
import Route35 from "./routes/api/v1/(authed)/stardance/compat/shop/index.ts";
import Route36 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/index.ts";
import Route37 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/devlogs/[devlogId].ts";
import Route38 from "./routes/api/v1/(authed)/stardance/compat/projects/[id]/devlogs/index.ts";
import Route39 from "./routes/api/v1/(authed)/stardance/(cookieProvided)/goiStats.ts";
import Route40 from "./routes/api/v1/(authed)/stardance/(cookieProvided)/internalGoiQueue.ts";
import Route41 from "./routes/api/v1/web/(hcaAuthed).ts";
import Route42 from "./routes/api/v1/web/login/getRedirectUrl.ts";
import Route43 from "./routes/api/v1/web/login/getOUT.ts";
import Route44 from "./routes/api/v1/web/login/sessionCheck.ts";
import Route45 from "./routes/api/v1/web/(hcaAuthed)/account.ts";
import Route46 from "./routes/api/v1/web/(hcaAuthed)/apiKeys.ts";
import Route47 from "./routes/api/v1/web/(hcaAuthed)/workers.ts";

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
        macondo: (typeof Route4)["~Routes"] & {
          orders: (typeof Route5)["~Routes"];
          projects: {
            ":id": (typeof Route6)["~Routes"] & {
              journals: (typeof Route7)["~Routes"];
            };
          };
          compat: {
            projects: {
              ":id": (typeof Route8)["~Routes"] & {
                devlogs: (typeof Route10)["~Routes"] & {
                  ":devlogId": (typeof Route9)["~Routes"];
                };
              };
            };
          };
        } & {};
        flavortown: (typeof Route11)["~Routes"] & {
          shop: (typeof Route13)["~Routes"] & {
            ":id": (typeof Route12)["~Routes"];
          };
          compat: {
            shop: (typeof Route15)["~Routes"] & {
              ":id": (typeof Route14)["~Routes"];
            };
            projects: {
              ":id": (typeof Route16)["~Routes"] & {
                devlogs: (typeof Route18)["~Routes"] & {
                  ":devlogId": (typeof Route17)["~Routes"];
                };
              };
            };
          };
          users: (typeof Route19)["~Routes"] & {
            ":id": (typeof Route20)["~Routes"] & {
              projects: (typeof Route21)["~Routes"];
            };
          };
          devlogs: (typeof Route23)["~Routes"] & {
            ":id": (typeof Route22)["~Routes"];
          };
          projects: {
            shop: (typeof Route25)["~Routes"] & {
              ":id": (typeof Route24)["~Routes"];
            };
            ":id": (typeof Route26)["~Routes"] & {
              devlogs: (typeof Route27)["~Routes"];
            };
          };
        } & {};
        stardance: (typeof Route28)["~Routes"] & {
          goiStats: (typeof Route39)["~Routes"];
          internalGoiQueue: (typeof Route40)["~Routes"];
        } & {
          shop: (typeof Route30)["~Routes"] & {
            ":id": (typeof Route29)["~Routes"];
          };
          projects: {
            ":id": (typeof Route31)["~Routes"] & {
              devlogs: (typeof Route33)["~Routes"] & {
                ":devlogId": (typeof Route32)["~Routes"];
              };
            };
          };
          compat: {
            shop: (typeof Route35)["~Routes"] & {
              ":id": (typeof Route34)["~Routes"];
            };
            projects: {
              ":id": (typeof Route36)["~Routes"] & {
                devlogs: (typeof Route38)["~Routes"] & {
                  ":devlogId": (typeof Route37)["~Routes"];
                };
              };
            };
          };
        };
      } & {
        web: (typeof Route41)["~Routes"] & {
          account: (typeof Route45)["~Routes"];
          apiKeys: (typeof Route46)["~Routes"];
          workers: (typeof Route47)["~Routes"];
        } & {
          login: {
            getRedirectUrl: (typeof Route42)["~Routes"];
            getOUT: (typeof Route43)["~Routes"];
            sessionCheck: (typeof Route44)["~Routes"];
          };
        };
      };
    };
  }
>;
