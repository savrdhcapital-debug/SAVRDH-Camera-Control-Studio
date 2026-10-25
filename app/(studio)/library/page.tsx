"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { camera, type MediaItem } from "@/lib/camera";
import { useCamera } from "@/components/CameraProvider";
import Icon from "@/components/Icon";
import { Btn, NotConnected } from "@/components/ui";

type Meta = { favorites: string[]; albums: Record<string, string[]>; downloaded: string[] };
const EMPTY: Meta = { favorites: [], albums: {}, downloaded: [] };
type Filter = "photo" | "video" | "fav" | `album:${string}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function triggerDownload(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Media Library: browse camera storage, download, organise (favorites/albums), delete, share. */
export default function LibraryPage() {
  const cam = useCamera();
  const connected = cam.status === "connected";
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<Meta>(EMPTY);
  const [filter, setFilter] = useState<Filter>("photo");
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [newAlbum, setNewAlbum] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await camera.listMedia());
    } catch (e) {
      cam.notify(e instanceof Error ? e.message : "Could not load media", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connected) void load();
  }, [connected, load, cam.shots, cam.takes.length]);

  useEffect(() => {
    fetch("/api/library/meta")
      .then((r) => r.json())
      .then((m: Meta) => setMeta(m))
      .catch(() => undefined);
  }, []);

  const saveMeta = useCallback((m: Meta) => {
    setMeta(m);
    void fetch("/api/library/meta", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m) });
  }, []);

  const visible = useMemo(() => {
    return items.filter((i) => {
      if (filter === "photo") return i.kind === "photo";
      if (filter === "video") return i.kind === "video";
      if (filter === "fav") return meta.favorites.includes(i.id);
      return (meta.albums[filter.slice(6)] ?? []).includes(i.id);
    });
  }, [items, filter, meta]);

  const chosen = items.filter((i) => sel.has(i.id));
  const openItem = visible.find((i) => i.id === open) ?? null;

  const toggleSel = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleFav = (id: string) =>
    saveMeta({ ...meta, favorites: meta.favorites.includes(id) ? meta.favorites.filter((x) => x !== id) : [...meta.favorites, id] });

  const downloadMany = async (list: MediaItem[]) => {
    if (!list.length) return cam.notify("Select one or more files first");
    cam.notify(`Downloading ${list.length} file(s)…`);
    for (const it of list) {
      triggerDownload(camera.mainUrl(it), it.name);
      await sleep(500);
    }
    saveMeta({ ...meta, downloaded: [...new Set([...meta.downloaded, ...list.map((l) => l.id)])] });
  };

  const deleteMany = async (list: MediaItem[]) => {
    if (!list.length) return cam.notify("Select one or more files first");
    if (!window.confirm(`Delete ${list.length} file(s) permanently from the camera card?`)) return;
    const gone: string[] = [];
    for (const it of list) {
      try {
        await camera.deleteMedia(it);
        gone.push(it.id);
      } catch (e) {
        cam.notify(`${it.name}: ${e instanceof Error ? e.message : "delete failed"}`, "error");
      }
    }
    setItems((l) => l.filter((i) => !gone.includes(i.id)));
    setSel(new Set());
    setOpen(null);
    saveMeta({
      favorites: meta.favorites.filter((x) => !gone.includes(x)),
      downloaded: meta.downloaded.filter((x) => !gone.includes(x)),
      albums: Object.fromEntries(Object.entries(meta.albums).map(([k, v]) => [k, v.filter((x) => !gone.includes(x))])),
    });
  };

  const shareMany = async (list: MediaItem[]) => {
    if (!list.length) return cam.notify("Select one or more files first");
    try {
      const files = await Promise.all(
        list.slice(0, 5).map(async (it) => {
          const b = await (await fetch(camera.mainUrl(it))).blob();
          return new File([b], it.name, { type: b.type || "image/jpeg" });
        }),
      );
      if (navigator.canShare?.({ files })) await navigator.share({ files });
      else cam.notify("Sharing is unavailable in this browser. Use Download instead.", "error");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) cam.notify("Share failed", "error");
    }
  };

  const addToAlbum = (album: string) => {
    if (!album || !chosen.length) return;
    const cur = meta.albums[album] ?? [];
    saveMeta({ ...meta, albums: { ...meta.albums, [album]: [...new Set([...cur, ...chosen.map((c) => c.id)])] } });
    cam.notify(`${chosen.length} item → ${album}`);
  };

  const createAlbum = () => {
    const name = newAlbum.trim().slice(0, 40);
    if (!name || meta.albums[name]) return;
    saveMeta({ ...meta, albums: { ...meta.albums, [name]: [] } });
    setNewAlbum("");
    setFilter(`album:${name}`);
  };

  if (!connected) return <NotConnected what="Media Library" />;

  const tab = (f: Filter, label: string) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      className={`rounded-xl px-4 py-2 text-sm font-semibold ${filter === f ? "bg-accent text-white" : "bg-panel2 text-muted hover:text-fg"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-d">
      <div className="flex flex-wrap items-center gap-2">
        {tab("photo", "Photos")}
        {tab("video", "Videos")}
        {tab("fav", `★ Favorites (${meta.favorites.length})`)}
        {Object.keys(meta.albums).map((a) => tab(`album:${a}`, a))}
        <div className="ml-auto flex items-center gap-2">
          <Btn variant="ghost" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Btn>
          <Btn
            variant="ghost"
            onClick={() => {
              setSelecting((s) => !s);
              setSel(new Set());
            }}
          >
            <span className="text-accent">{selecting ? "Done" : "Select"}</span>
          </Btn>
        </div>
      </div>

      {selecting && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-panel p-2 text-sm">
          <span className="px-2 text-muted">{sel.size} selected</span>
          <Btn variant="ghost" onClick={() => setSel(new Set(visible.map((v) => v.id)))}>All</Btn>
          <select
            defaultValue=""
            onChange={(e) => {
              addToAlbum(e.target.value);
              e.target.value = "";
            }}
            className="rounded-xl border border-line/10 bg-panel2 px-3 py-2 text-fg"
          >
            <option value="">Add to album…</option>
            {Object.keys(meta.albums).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <input
            value={newAlbum}
            onChange={(e) => setNewAlbum(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createAlbum()}
            placeholder="New album"
            className="w-32 rounded-xl border border-line/10 bg-panel2 px-3 py-2 text-fg outline-none focus:border-accent"
          />
          <Btn onClick={createAlbum}>Create</Btn>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line/20 p-10 text-center text-sm text-muted">
          {loading ? "Loading…" : "No media matches this filter."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((it) => {
            const picked = sel.has(it.id);
            return (
              <button
                key={it.id}
                onClick={() => (selecting ? toggleSel(it.id) : setOpen(it.id))}
                className={`group relative aspect-[3/2] overflow-hidden rounded-xl border bg-panel2 ${picked ? "border-accent ring-2 ring-accent" : "border-line/10"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={camera.thumbUrl(it)} alt={it.name} loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{it.name}</span>
                {meta.favorites.includes(it.id) && <span className="absolute right-1 top-1 text-yellow-300">★</span>}
                {meta.downloaded.includes(it.id) && <span className="absolute left-1 top-1 rounded bg-ok px-1 text-[10px] font-bold text-black">✓</span>}
                {selecting && (
                  <span className={`absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full border ${picked ? "border-accent bg-accent text-white" : "border-white/70 bg-black/30"}`}>
                    {picked && <Icon name="check" className="h-3 w-3" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-16 z-10 flex justify-around rounded-2xl border border-line/10 bg-panel/95 p-2 backdrop-blur md:bottom-0">
        {[
          { l: "Download", i: "download" as const, f: () => downloadMany(chosen) },
          { l: "Delete", i: "trash" as const, f: () => deleteMany(chosen) },
          { l: "Share", i: "share" as const, f: () => shareMany(chosen) },
          { l: "Import All", i: "import" as const, f: () => downloadMany(items.filter((i) => !meta.downloaded.includes(i.id))) },
        ].map((b) => (
          <button key={b.l} onClick={() => void b.f()} className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-xs text-muted hover:bg-line/10 hover:text-fg">
            <Icon name={b.i} />
            {b.l}
          </button>
        ))}
      </div>

      {openItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
            <span className="font-semibold">{openItem.name}</span>
            <div className="flex gap-2">
              <Btn onClick={() => toggleFav(openItem.id)}>{meta.favorites.includes(openItem.id) ? "★ Unfavorite" : "☆ Favorite"}</Btn>
              <Btn onClick={() => void downloadMany([openItem])}>Download</Btn>
              <Btn variant="danger" onClick={() => void deleteMany([openItem])}>Delete</Btn>
              <Btn variant="ghost" onClick={() => setOpen(null)}>Close</Btn>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center" onClick={(e) => e.stopPropagation()}>
            {openItem.kind === "video" ? (
              <video src={camera.mainUrl(openItem)} controls className="max-h-full max-w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={camera.displayUrl(openItem)} alt={openItem.name} className="max-h-full max-w-full object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
