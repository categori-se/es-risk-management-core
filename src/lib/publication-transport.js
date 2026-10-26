// Anonymous publication reads never use a notebook editor's credentials.
export function publicationApiBase(value = "", origin = globalThis.location?.origin) {
  const url = new URL(value || origin, origin), same = url.origin === origin;
  if ((!same && !/^https:\/\/[a-z0-9]+\.execute-api\.us-east-1\.amazonaws\.com$/.test(url.origin)) ||
      url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname) ||
      url.protocol !== "https:" && !(same && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("The publication API origin is not configured.");
  return url.origin;
}
