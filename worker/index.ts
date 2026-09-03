// Serves the built static app from `dist` and stamps every response with the
// two headers the WebMCP origin isolation contract requires (PRD section 14)
// plus three defense-in-depth headers (nosniff, no-referrer, frame-deny).

export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Origin-Agent-Cluster", "?1");
    headers.set("Permissions-Policy", "tools=(self)");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Frame-Options", "DENY");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
