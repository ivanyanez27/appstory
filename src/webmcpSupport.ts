// Feature-detects the WebMCP registration API. Split out from the old
// `WorldTools.tsx`, which paired this with a React component that registered
// the product's earlier 12-tool Living Story World surface — that surface
// has no caller left under App Story's 6 tools (see `AppStoryTools.tsx`),
// but the detection this file now holds alone is still load-bearing: the
// status chip in `App.tsx` uses it to tell a visitor whether to expect
// WebMCP at all.
export function webmcpSupported(): boolean {
  if (typeof document === "undefined") return false;
  const nav = navigator as Navigator & { modelContext?: { registerTool?: unknown } };
  const ctx = document.modelContext ?? nav.modelContext;
  return Boolean(ctx && typeof ctx.registerTool === "function");
}
