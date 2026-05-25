/** Tiny client-side auth helpers backed by localStorage.
 *  Not real auth — just gates the admin routes so logout actually does
 *  something and the login page is the first stop. */

const KEY = "chua.auth";

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function signIn(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function signOut(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
