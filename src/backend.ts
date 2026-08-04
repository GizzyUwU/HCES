import { treaty } from "@elysiajs/eden";
import type { App } from "@server/routes";
const serverClient = treaty<App>(window.location.origin);
export default serverClient;