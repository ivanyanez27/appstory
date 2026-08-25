# Living Story World — Design Spec

Date: 2026-08-25
Repo: `storytime`
Hackathon: [WebMCP Challenge](https://openai.com/webmcp-challenge/) (deadline 2026-09-03)

A parchment infinite canvas where a human and ChatGPT co-build a story universe on the same page. ChatGPT writes the story; the page is the living board. Agents do not click the UI. They call WebMCP tools that mutate the canvas.

## Goal

Ship a visually distinctive, agent-native web app that is meaningfully better when a person and ChatGPT use it together. The 60–90s demo: you ask ChatGPT to start a fantasy world; characters, places, plot beats, notes, regions, and arrows appear on a storybook parchment while you drag, edit, and attach images.

## Non-goals (v1)

- On-page chatbot or any app-owned LLM
- Backend, accounts, or shareable world URLs
- Agent-generated images (no image API)
- Agent freehand drawing / pencil
- Multiplayer sync
- A “wipe the world” tool
- Mobile-first layout (desktop / ChatGPT in-app browser)

## Decisions (locked)

| Decision | Choice |
|---|---|
| Board | Freeform infinite canvas |
| Look | Storybook parchment (warm paper, ink, gold rules) |
| Agent | ChatGPT / native WebMCP only — no companion panel |
| Images | Optional URL on any card; no generation |
| Persistence | `localStorage` in this browser |
| Canvas engine | tldraw + custom shapes |
| Stack | Vite + React + TypeScript, Chrome `use-webmcp-tool`, `webmcp-types`, static host, no server |

## User experience

### Shell

- Thin header: product name, editable world name, WebMCP status chip (`ready · N tools` or `unsupported — open in ChatGPT`), live card count vs cap (`12 / 50`).
- Header control: **How to play** — popover, not a permanent drawer.
- Full remaining viewport is the tldraw parchment canvas.
- Bottom legend always visible: Character · Place · Plot · Note · Region, plus one-line hint: “Ask ChatGPT to start a world.”
- Agent toast (top-right, auto-dismiss ~2.5s) when a tool mutates the board, e.g. “Agent added *Whispering Woods*.”
- **Visible actuation:** a mutating tool also selects the affected card(s) and plays a short parchment pulse (gold dashed outline, ~600ms). This is the canvas equivalent of Chrome’s `:tool-form-active` — the human must see the agent work on the same surface.
- No chat panel. No agent toolbox in the chrome. Humans use tldraw; the agent uses tools.

### How to play popover

1. Open this page in ChatGPT’s in-app browser (or Chrome 149+ with WebMCP enabled).
2. Ask it to start a world (“Let’s make a fantasy story in a small kingdom…”).
3. Drag cards, edit text, attach image URLs, draw if you want.
4. Lists the tools in plain language (add-tools disappear from the live chip when the world is full).

### Empty state

Empty parchment, no sample world. Centered italic hint: “Open this in ChatGPT and say: start a fantasy world.” Hint hides after the first card exists.

### Card types (custom tldraw shapes)

| Type | Visual | Fields |
|---|---|---|
| Character | Gold/ink rule, filled parchment | name, summary, optional image |
| Place | Green rule | name, summary, optional image |
| Plot | Dashed crimson rule | name, summary, optional image |
| Note | Smaller sticky, no type chrome beyond a tick | text |
| Region | Large dashed parchment frame, title on the rim | name, width × height |

Humans can still use native tldraw drawing (pencil, stickers, geo). That ink is persisted with the document but is not in `get_world_state` (see Data model). The agent cannot create freehand ink.

### Images

`imageUrl` is stored as a string. The card renders an `<img>`. On error, show a parchment placeholder (“image missing”) and keep the URL. No upload, no proxy, no generation. `set_element_image` sets `untrustedContentHint: true`.

## Architecture

```
You  ↔  tldraw parchment (one Editor / store)  ↔  ChatGPT
                    ↑
         WebMCP tools in this page
                    ↑
         document.modelContext.registerTool
```

- Pure SPA. HTTPS static hosting (localhost is a trustworthy origin for local dev).
- Feature-detect **`document.modelContext`** first, then `navigator.modelContext` (deprecated in Chromium 150). Register only if `registerTool` exists.
- No polyfill in v1. Unsupported browsers still get a working human canvas; the status chip explains how to open ChatGPT.
- TypeScript types from `webmcp-types`.
- Headers (required for Chrome WebMCP): `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)`. WebMCP is disabled if the document is not origin-isolated.
- Do **not** pass `exposedTo`. Tools stay same-origin only.
- Tools call a **world module** (pure functions on a `World` object). A thin adapter projects `World` ↔ tldraw custom shapes. Tools never touch the editor directly in tests.
- **Source of truth for persistence** is one tldraw store snapshot (custom cards + arrows + any human freehand ink) plus `worldName`. Key: `localStorage['lsw.v1']`. Load on boot. Debounce writes (300ms). Quota failure: keep memory, toast “couldn’t save in this browser.”
- On load, rebuild `World` by reading custom shape props out of the snapshot (`worldFromSnapshot`). Human freehand ink is in the snapshot but ignored by `worldFromSnapshot` and by `get_world_state`.

## Components (code units)

Each unit has one job. No god-file App.

| Unit | Does | Depends on |
|---|---|---|
| `world.ts` | Pure world model: cards, links, cap, CRUD, validation, `worldFromSnapshot`, `summarizeWorld(world, selectedIds)` | nothing |
| `world.test.ts` | Tests for `world.ts` and tool executors | `world.ts`, `tools.ts` |
| `tools.ts` | Tool definitions: name, description, JSON Schema, executor wrapping `world.ts` | `world.ts` |
| `WorldTools.tsx` | Chrome `useWebMCP` hook per tool; add-tools unmount at cap 50 | `tools.ts`, `use-webmcp-tool` |
| `canvas.tsx` | tldraw `Tldraw`, custom shapes, parchment CSS, camera `focus` | tldraw, shape components |
| `shapes/` | Character, Place, Plot, Note, Region shape utils + components | tldraw |
| `persist.ts` | Load/save snapshot | tldraw store snapshot type |
| `App.tsx` | Shell: header, legend, How to play, toast, wire tools ↔ editor | all of the above |
| `status.tsx` | WebMCP chip + card count | `webmcp.ts` |

`App.tsx` owns the tldraw `Editor` ref. On mount: load snapshot → create editor → register tools with closures over the editor → abort signal on unmount.

## Data model

Tools read and write a `World` object in `world.ts`. The adapter projects that onto tldraw custom shapes (and arrows). tldraw also holds human freehand ink, which is saved with the document and is invisible to tools.

```ts
type CardType = "character" | "place" | "plot" | "note" | "region"

type Card = {
  id: string            // `${type}_${nanoid(8)}` e.g. character_ab12cd34
  type: CardType
  name: string          // note uses name as the note body if summary empty; prefer `summary` for plot/character/place
  summary: string       // note: unused (empty). region: unused (empty)
  imageUrl: string | null
  x: number
  y: number
  w: number             // region required; others have defaults
  h: number
}

type Link = {
  id: string            // `link_${nanoid(8)}`
  fromId: string
  toId: string
  label: string         // empty string if unlabeled
}

type World = {
  name: string          // header; human-edited; default "Untitled world"
  cards: Card[]
  links: Link[]
}

const MAX_CARDS = 50
```

Default sizes:

- character / place / plot: 220 × 140 (taller if `imageUrl` set, 220 × 200)
- note: 180 × 100
- region: 480 × 320 unless the tool passes `w`/`h`

Auto-layout: if `x`/`y` omitted, place on a 260px grid, scanning left-to-right, wrapping every 4 columns, starting at (0, 0) in tldraw page space, skipping occupied cells.

IDs are generated by `world.ts`. Tools never invent IDs. Tool results return the new id. The tldraw shape id for a card **is** the card id. The tldraw arrow id for a link **is** the link id. That way `focus_element` and `delete_element` address the store directly.

`get_world_state` returns a **compact index**, not full summaries (Chrome’s ~1.5K output budget). Full card text is `inspect_element`. It does **not** include native tldraw freehand shapes. It **does** include `selectedIds` so the agent can see what the human has highlighted.

Links are tldraw arrows between card shape IDs. Deleting a card removes incident links.

## WebMCP contract (from the spec + Chrome guidance)

Register on `document.modelContext` (fallback `navigator.modelContext`) with `AbortController` for unmount. Tool names match `^[A-Za-z0-9_.-]{1,128}$`.

Each tool has:

- `name` (verb, ≤30 chars)
- `title` (human label for inspector / native UI)
- `description` (what it does and when to use it, positive language, ≤500 chars)
- `inputSchema` (JSON Schema; each property `description` ≤150 chars). Use enums for closed sets. **Validate strictly in code** — schema is a hint, not a guarantee.
- `execute(input, { signal })` — if `signal.aborted`, return `{ ok: false, error: "cancelled" }` and do not mutate.
- `annotations`: `readOnlyHint` on tools that do not change the world; `untrustedContentHint` on tools that return or ingest user/external text or URLs.

`execute` returns a JSON-serializable object (the browser stringifies it). Chrome recommends **≤1500 characters per result**. Keep payloads compact.

```ts
type ToolOk = { ok: true; message: string } & Record<string, unknown>
type ToolErr = { ok: false; error: string }
```

On `{ ok: false }`, do not mutate. Do not throw for expected errors (missing id, cap, bad URL, cancelled). Throw only for unexpected exceptions.

Every mutating tool also:

1. Applies the world patch to tldraw.
2. Selects the affected shape(s) and plays the parchment pulse.
3. Shows the agent toast with `message`.
4. Schedules persist.

**Dynamic registration:** while `cardCount >= 50`, unregister `add_character`, `add_place`, `add_plot_point`, `add_note`, and `add_region` (one AbortController for the add-set). Re-register when a delete brings the count under 50. Static registration for the rest. This follows Chrome’s “register tools when they are useful.”

Do not use the Declarative (HTML form) API. This app is a canvas, not a form.

### Shared field rules

### Shared field rules

- `name` / `summary` / `text` / `label`: trim; reject empty `name` (or `text` for notes) with `{ ok: false, error: "name is required" }`.
- `imageUrl`: if present, must parse as `http:` or `https:` URL; otherwise `{ ok: false, error: "imageUrl must be an http(s) URL" }`.
- Missing card id: `{ ok: false, error: "unknown id: …" }`.
- Cap: any add that would exceed 50 cards: `{ ok: false, error: "world is full (50 cards). Delete something first." }`. Links do not count toward the cap.

### Tools

1. **get_world_state**  
   Title: Read the world  
   Description: Compact index of the story world plus whatever the human currently has selected. Call this before changing anything. Does not include full summaries — use inspect_element for one card.  
   Input: `{}`  
   Annotations: `readOnlyHint: true`, `untrustedContentHint: true` (names are user-written)  
   Result (compact):  
   `{ ok, message, name, cardCount, maxCards, selectedIds, truncated, cards: [{ id, type, name }], links: [{ id, fromId, toId, label }] }`  
   Rules: `name` truncated to 40 chars; `label` to 24. Include at most 20 cards: `selectedIds` first, then the rest newest-first. If more exist, `truncated: true` (real total is `cardCount`). No `summary`, `imageUrl`, or coordinates. Target JSON ≤1500 chars.

2. **inspect_element**  
   Title: Inspect a card  
   Description: Return the full fields of one card, note, region, or link (summary, image URL, position). Use after get_world_state when you need the text, not just the name.  
   Input: `{ id: string }`  
   Annotations: `readOnlyHint: true`, `untrustedContentHint: true`  
   Result: `{ ok, message, card | link }` (one object). Truncate `summary` to 500 chars in the payload.

3. **add_character**  
   Title: Add character  
   Description: Add a character card to the parchment.  
   Input: `{ name: string, summary?: string, imageUrl?: string, x?: number, y?: number }`  
   Annotations: `untrustedContentHint: true` (optional image URL)  
   Result: `{ ok, message, id }`

4. **add_place**  
   Title: Add place  
   Description: Add a location card to the parchment.  
   Input: `{ name: string, summary?: string, imageUrl?: string, x?: number, y?: number }`  
   Annotations: `untrustedContentHint: true`  
   Result: `{ ok, message, id }`

5. **add_plot_point**  
   Title: Add plot beat  
   Description: Add a plot-beat card (something that happens in the story).  
   Input: `{ name: string, summary?: string, imageUrl?: string, x?: number, y?: number }`  
   Annotations: `untrustedContentHint: true`  
   Result: `{ ok, message, id }`

6. **add_note**  
   Title: Pin a note  
   Description: Pin a short parchment note (a thought, secret, or reminder). Not a character, place, or plot beat.  
   Input: `{ text: string, x?: number, y?: number }`  
   Result: `{ ok, message, id }`  
   Mapping: `text` → card `name`; `type: "note"`.

7. **add_region**  
   Title: Draw a region  
   Description: Draw a labeled dashed frame to group an area of the world (for example “The Northern Reaches”).  
   Input: `{ name: string, x?: number, y?: number, w?: number, h?: number }`  
   Result: `{ ok, message, id }`

8. **connect_elements**  
   Title: Connect two cards  
   Description: Draw a labeled arrow from one card, note, or region to another.  
   Input: `{ fromId: string, toId: string, label?: string }`  
   Errors: unknown ids; `fromId === toId`; duplicate pair → `{ ok: false, error: "already connected" }`.  
   Result: `{ ok, message, id }` (link id)

9. **update_element**  
   Title: Update a card  
   Description: Change name, summary, or position of an existing card, note, or region.  
   Input: `{ id: string, name?: string, summary?: string, x?: number, y?: number, w?: number, h?: number }`  
   At least one of name/summary/x/y/w/h required.  
   Result: `{ ok, message, id }`

10. **set_element_image**  
    Title: Set card image  
    Description: Set or clear the image URL on a character, place, or plot card. Does not generate an image. Pass an empty string to clear.  
    Input: `{ id: string, imageUrl: string }`  
    Errors: id is note or region → `{ ok: false, error: "notes and regions cannot have images" }`.  
    Annotations: `untrustedContentHint: true`  
    Result: `{ ok, message, id }`

11. **focus_element**  
    Title: Focus a card  
    Description: Pan and zoom the canvas so a card is centered on screen. Does not change the world.  
    Input: `{ id: string }`  
    Annotations: `readOnlyHint: true`  
    Result: `{ ok, message, id }`

12. **delete_element**  
    Title: Delete a card  
    Description: Remove a card, note, region, or link. Incident arrows are removed with a card. The human can undo from the canvas (Ctrl/Cmd+Z).  
    Input: `{ id: string }`  
    Result: `{ ok, message, id }`  
    No extra confirm dialog. tldraw undo is the safety net. Do not call the draft `requestUserInteraction()` API in v1 (availability in ChatGPT’s browser is unknown).

There is no `clear_world` tool. Add-tools are absent from the registry when the world is full.

## Data flow

1. Boot → `persist.load()` → if missing/corrupt, empty tldraw snapshot + `"Untitled world"`. Put snapshot into `Tldraw`. Derive `World` via `worldFromSnapshot`.
2. `webmcp.register(tools, editor)` → always-on tools with one `AbortController`; add-tools with a second controller that is aborted/recreated at the 50-card cap.
3. Human edits a card on canvas → shape props change → next `get_world_state` / persist sees it (world is always derived from the store). Header name writes `worldName` into persist payload.
4. Agent calls a tool → read `World` from editor → `world.ts` function → if `{ ok: false }`, stop. If ok, adapter applies the new `World` delta to shapes/arrows → toast → persist.
5. Unmount / hot reload → abort signal unregisters tools.

## Error handling

| Case | Behavior |
|---|---|
| No `modelContext` | Canvas works. Chip: “WebMCP unsupported — open in ChatGPT”. Tools not registered. |
| `registerTool` rejects | Chip: “WebMCP error”. Console warning. Canvas works. |
| Expected tool error | `{ ok: false, error }` — board unchanged, no toast. |
| Unexpected throw | Let WebMCP mark the execution failed. Console error. Board unchanged if the world function did not commit. |
| Execute `signal` aborted | `{ ok: false, error: "cancelled" }`, no mutation |
| 50-card cap | Add tools return the cap error. |
| Bad / broken image URL | Reject at set-time if not http(s). If it was valid but fails to load, placeholder in the card. |
| `localStorage` quota / disabled | In-memory world continues. Toast once per session. |
| Delete unknown id | `{ ok: false, error }` |

## Testing

Framework: Vitest. No ChatGPT in CI. No browser WebMCP in unit tests.

Must pass:

- `world.ts`: add each type; auto-layout; cap at 50; delete card drops incident links; update; set/clear image; reject empty name; reject non-http(s) imageUrl; reject self-link; reject duplicate link; reject image on note/region.
- `tools.ts`: each executor maps input → world function → `{ ok: true/false }` without a tldraw editor. Compact `get_world_state`: selected-first, max 20, truncation flags, JSON string length ≤1500 with a 50-card fixture. `inspect_element` returns full summary. Cancelled `signal` returns `{ ok: false }` with no mutation.
- `persist.ts`: round-trip snapshot; corrupt JSON loads as empty world.

Manual (README):

1. `npm run dev` on localhost — canvas, cards, persist across refresh.
2. Chrome 149+ with `chrome://flags/#enable-webmcp-testing` — tools appear. Optional: [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) to list/call tools without ChatGPT.
3. ChatGPT desktop in-app browser — demo script below.

## Demo script (README)

Record 60–90s in ChatGPT’s in-app browser.

1. Open the live URL. Show empty parchment + How to play.
2. “Let’s make a fantasy story. Start with a small kingdom called Eldoria that has a young queen named Lyra who is afraid of the dark, and a mysterious forest called the Whispering Woods.”
3. Cards appear; agent connects Lyra to Eldoria and the Woods. Toast visible.
4. Human drags Lyra closer to the woods, types a sticky thought, **selects Lyra**.
5. “What happens when she enters the forest at night?” — agent uses `selectedIds`, adds a plot card + region “The tree line.” Pulse + toast visible.
6. Optional: `set_element_image` with a public https URL.

## Visual / theme

- Page background and tldraw background: warm parchment (`#e8d9b8` / `#e4d2a8`), faint fiber noise optional (CSS only, no image asset required).
- Cards: `#f4ead0`, 1px ink rules, 3px offset shadow in gold/green/crimson by type.
- Typography: Georgia / `ui-serif` for cards and header; system-ui for the WebMCP chip.
- tldraw UI chrome: keep default but restyle background; hide the style panel if it fights the parchment, keep select/hand/draw/undo.

## Hosting and submission

- Static `vite build`. Host on Cloudflare Pages, Vercel, or Netlify (HTTPS).
- Response headers: `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)`. (Vite `server.headers` in dev; host `_headers` / `vercel.json` / `netlify.toml` in prod.)
- MIT license at repo root (hackathon requires a visible open-source license).
- README: what it is, How to play, Chrome flag, inspector extension, demo script, tool list.
- Submission needs a working live URL judges can open in ChatGPT’s in-app browser.

## File layout (v1)

```
storytime/
  README.md
  LICENSE
  package.json
  index.html
  src/
    main.tsx
    App.tsx
    styles.css
    world.ts
    world.test.ts
    tools.ts
    tools.test.ts
    webmcp.ts
    persist.ts
    persist.test.ts
    canvas.tsx
    status.tsx
    help.tsx
    toast.tsx
    shapes/
      character.tsx
      place.tsx
      plot.tsx
      note.tsx
      region.tsx
      index.ts
  docs/superpowers/specs/2026-08-25-living-story-world-design.md
```

## Explicitly not in v1 (from the docs)

- **Declarative HTML-form tools** (`toolname` / `tooldescription`) — no forms on this page.
- **`requestUserInteraction()`** — draft client API; ChatGPT support unknown. Undo covers delete.
- **`exposedTo` / iframe `allow="tools"`** — single-page app, same origin only.
- **In-page agent via `getTools()` + `executeTool()`** — user chose ChatGPT-only.
- **Chrome origin-trial token** — ChatGPT’s browser is the submission target; local Chrome uses the flag.

## References

- [WebMCP spec](https://webmachinelearning.github.io/webmcp/) (19 August 2026)
- [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp)
- [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)

## Implementation order

1. Vite React-TS app + parchment shell (header, legend, How to play) with a dummy canvas.
2. `world.ts` + tests (cap, CRUD, links).
3. tldraw + five custom shapes + persist.
4. `tools.ts` + `webmcp.ts` wired to the editor; toasts, pulse, abort signal, cap unregister.
5. Headers, theme, empty state, README, MIT license, deploy.
