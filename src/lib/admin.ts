/** HuckHub admin — careers and throw-side admin tools share this identity. */
export const ADMIN_USER_ID = "b9ad6050-f56c-42a9-bb6f-5ce24347c9a7";

export function isAdmin(userId: string | null | undefined): boolean {
  return Boolean(userId && userId === ADMIN_USER_ID);
}
