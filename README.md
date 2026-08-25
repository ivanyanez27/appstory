# Living Story World

A parchment infinite canvas where a **human and ChatGPT build a story universe on the same page**. ChatGPT writes; the board is the living world. Agents do not click around. They call WebMCP tools that drop characters, places, plot beats, notes, regions, and arrows onto the canvas.

Built for the [WebMCP Challenge](https://openai.com/webmcp-challenge/).

## Why this exists

Writers, game masters, and kids already talk to ChatGPT about stories. The conversation stays in chat while the world stays in their head. This app gives that conversation a **shared surface**: you drag Queen Lyra toward the woods, the agent sees she is selected, and the next scene appears as a card you can both edit.

That is the future of the open web this challenge asks for — humans and agents collaborating in one interface, with the site declaring exactly what the agent may do.

## How to play

1. Open the live site in **ChatGPT’s desktop in-app browser** (WebMCP works out of the box).
2. Say: *Let’s make a fantasy story. Start with a small kingdom called Eldoria that has a young queen named Lyra who is afraid of the dark, and a mysterious forest called the Whispering Woods.*
3. Drag cards, type on them, attach `https` image URLs.
4. Select a card and ask what happens next — `get_world_state` includes `selectedIds` so the agent knows who you mean.

### Chrome (local)

1. `chrome://flags/#enable-webmcp-testing` → Enabled → relaunch.
2. Optional: [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd).
3. `npm run dev` and open the local URL (HTTPS/localhost is a trustworthy origin).

## Tools

Twelve in-page tools on `document.modelContext`, registered with Chrome’s [`use-webmcp-tool`](https://github.com/GoogleChromeLabs/use-webmcp-tool) hook:

| Tool | Role |
|---|---|
| `get_world_state` | Compact index + current selection (≤1.5K) |
| `inspect_element` | Full card / link |
| `add_character` / `add_place` / `add_plot_point` | Story cards |
| `add_note` / `add_region` | Notes and labeled frames |
| `connect_elements` | Labeled arrows |
| `update_element` / `set_element_image` | Edit |
| `focus_element` | Pan/zoom |
| `delete_element` | Remove (human can undo) |

Add-tools unregister at 50 cards. Read tools set `readOnlyHint`. User text and image URLs set `untrustedContentHint`.

## Stack

Vite, React, TypeScript, [tldraw](https://tldraw.dev), `use-webmcp-tool`, `webmcp-types`. No backend. State lives in this browser (`localStorage`).

Headers: `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)` (required for Chrome WebMCP).

## Develop

```bash
npm install
npm test
npm run dev
npm run build
```

Deploy the `dist/` folder to Netlify, Cloudflare Pages, or Vercel (HTTPS).

## License

MIT
