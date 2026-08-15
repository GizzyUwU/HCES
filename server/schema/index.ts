import { users, session, oauthToken } from "./users";
import { apiKeys } from "./apiKeys";
import { workers } from "./workers";
const tables = {
  users,
  session,
  oauthToken,
  apiKeys,
  workers
} as const;
export default tables;
export type Table = typeof tables;
