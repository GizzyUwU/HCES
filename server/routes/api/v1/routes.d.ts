import type {
  Elysia,
  SingletonBase,
  DefinitionBase,
  MetadataBase,
} from "elysia";

import Route0 from "./(authed)/me.ts";
import Route1 from "./(authed)/stardance/(cookieProvided).ts";
import Route2 from "./(authed)/stardance/(cookieProvided)/goiStats.ts";

export type App = Elysia<
  string,
  SingletonBase,
  DefinitionBase,
  MetadataBase,
  {
    me: (typeof Route0)["~Routes"];
    stardance: (typeof Route1)["~Routes"] & {
      goiStats: (typeof Route2)["~Routes"];
    } & {};
  }
>;
