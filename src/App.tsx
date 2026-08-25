import { useCallback, useEffect, useRef, useState } from "react";
import { getSnapshot, loadSnapshot, type Editor } from "tldraw";
import { Canvas } from "./canvas";
import { WorldTools, webmcpSupported } from "./WorldTools";
import { StatusChip, CardCount } from "./status";
import { HowToPlay } from "./help";
import { AgentToast } from "./toast";
import { Legend } from "./legend";
import { load, save } from "./persist";
import { ADD_TOOL_NAMES, TOOLS } from "./tools";
import { worldFromEditor } from "./adapter";
import { MAX_CARDS } from "./world";
import "./styles.css";

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [worldName, setWorldName] = useState("Untitled world");
  const [toast, setToast] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [cardCount, setCardCount] = useState(0);
  const nameRef = useRef(worldName);
  nameRef.current = worldName;
  const persistTimer = useRef<number | null>(null);

  const persistNow = useCallback(
    (ed: Editor) => {
      const result = save(window.localStorage, {
        v: 1,
        worldName: nameRef.current,
        snapshot: getSnapshot(ed.store),
      });
      if (!result.ok) setToast("couldn’t save in this browser");
    },
    [],
  );

  const schedulePersist = useCallback(() => {
    if (!editor) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => persistNow(editor), 300);
  }, [editor, persistNow]);

  const onReady = useCallback((ed: Editor) => {
    const saved = load(window.localStorage);
    if (saved?.snapshot) {
      try {
        loadSnapshot(ed.store, saved.snapshot as Parameters<typeof loadSnapshot>[1]);
        setWorldName(saved.worldName);
        nameRef.current = saved.worldName;
      } catch {
        // corrupt snapshot — start empty
      }
    }
    ed.store.listen(() => {
      setCardCount(worldFromEditor(ed, nameRef.current).cards.length);
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => persistNow(ed), 300);
    });
    setCardCount(worldFromEditor(ed, nameRef.current).cards.length);
    setEditor(ed);
  }, [persistNow]);

  useEffect(() => {
    setSupported(webmcpSupported());
  }, [editor]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const addEnabled = cardCount < MAX_CARDS;
  const toolCount = TOOLS.filter(
    (t) => addEnabled || !(ADD_TOOL_NAMES as readonly string[]).includes(t.name),
  ).length;

  return (
    <div className="lsw-app">
      <header className="lsw-header">
        <div>
          <div className="lsw-title">Living Story World</div>
          <input
            className="lsw-world-name"
            value={worldName}
            onChange={(e) => {
              setWorldName(e.target.value);
              schedulePersist();
            }}
            aria-label="World name"
          />
          <div className="lsw-sub">saved in this browser</div>
        </div>
        <div className="lsw-header-right">
          <StatusChip supported={supported} toolCount={toolCount} />
          <CardCount cardCount={cardCount} />
          <HowToPlay />
        </div>
      </header>
      <main className="lsw-main">
        <Canvas onReady={onReady} />
        {cardCount === 0 && (
          <div className="lsw-empty">
            Open this in ChatGPT and say: start a fantasy world.
          </div>
        )}
        <AgentToast message={toast} />
      </main>
      <Legend />
      <WorldTools
        editor={editor}
        worldName={worldName}
        cardCount={cardCount}
        onToast={setToast}
        onPersist={schedulePersist}
      />
    </div>
  );
}
