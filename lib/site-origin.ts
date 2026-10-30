export function siteOrigin(request: Request) {
  return process.env.APP_ORIGIN || new URL(request.url).origin;
}
