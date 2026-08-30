import type { Static } from "elysia";
import type { CPTypes } from "./types";

export interface CPScraperAdapter {
  project(data: Static<typeof CPTypes["ProjectParams"]>): Promise<Static<typeof CPTypes["Project"]> | null>;
  shop(data?: Static<(typeof CPTypes)["ShopParams"]>): Promise<Static<typeof CPTypes["ShopItems"]> | null>;
  devlogs(data: Static<typeof CPTypes["DevlogParams"]>): Promise<Static<typeof CPTypes["Devlogs"]> | null>;
}