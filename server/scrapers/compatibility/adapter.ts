import type { Static } from "elysia";
import type { CompatTypes } from "./types";

export interface CompatScraperAdapter {
  project(data: Static<typeof CompatTypes["ProjectParams"]>): Promise<Static<typeof CompatTypes["Project"]> | null>;
  shop(data?: Static<(typeof CompatTypes)["ShopParams"]>): Promise<Static<typeof CompatTypes["ShopItems"]> | null>;
  devlogs(data: Static<typeof CompatTypes["DevlogParams"]>): Promise<Static<typeof CompatTypes["Devlogs"]> | null>;
}