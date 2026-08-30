// Serves the built static app from `dist` and stamps every response with the
// two headers the WebMCP origin isolation contract requires (PRD section 14).
// `public/_headers`, `netlify.toml`, and `vercel.json` cover the same
// requirement for Netlify/Vercel; this is the Cloudflare Workers equivalent.

export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Origin-Agent-Cluster", "?1");
    headers.set("Permissions-Policy", "tools=(self)");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
