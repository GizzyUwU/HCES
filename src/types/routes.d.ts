import type {
  Elysia,
  SingletonBase,
  DefinitionBase,
  MetadataBase,
} from "elysia";

export type App = Elysia<string, SingletonBase, DefinitionBase, MetadataBase>;
