import { users, session, oauthToken } from "./users"
const tables = {
  users,
  session,
  oauthToken,
} as const;
export default tables;
export type Table = typeof tables;