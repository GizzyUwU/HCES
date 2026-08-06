import { users, session, oauthToken } from "./users"
import { apiKeys } from "./apiKeys"
const tables = {
  users,
  session,
  oauthToken,
  apiKeys
} as const;
export default tables;
export type Table = typeof tables;