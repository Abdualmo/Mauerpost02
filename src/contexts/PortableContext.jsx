import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clearFileHandle,
  downloadJson,
  ensurePermission,
  hasFileSystemAccess,
  pickExistingFile,
  pickFileClassic,
  pickNewFile,
  readFileHandle,
  restoreFileHandle,
  writeFileHandle,
} from "../lib/portable.js";
import { exportAll, importAll, onDataChange } from "../lib/storage.js";

const PortableContext = createContext(null);

export function PortableProvider({ children, onDataImported }) {
  const [handle, setHandle] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [error, setError] = useState("");
  const supportsFS = hasFileSystemAccess();
  const saveTimer = useRef(null);
  const suspendSave = useRef(false); // avoid write-loop on import
  const lastHandleName = useRef("");

  // Try to restore a previously chosen file handle on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const h = await restoreFileHandle();
      if (cancelled || !h) return;
      setHandle(h);
      lastHandleName.current = h.name || "";
      // Try to load its content silently if permission is already granted.
      try {
        const perm = await h.queryPermission({ mode: "readwrite" });
        if (perm === "granted") {
          const data = await readFileHandle(h);
          if (data) {
            suspendSave.current = true;
            importAll(data);
            suspendSave.current = false;
            onDataImported && onDataImported();
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSave = useCallback(async () => {
    if (!handle || suspendSave.current) return;
    setStatus("saving");
    try {
      const ok = await ensurePermission(handle);
      if (!ok) throw new Error("Speicher-Berechtigung wurde verweigert.");
      await writeFileHandle(handle, exportAll());
      setStatus("saved");
      setError("");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (e) {
      setStatus("error");
      setError(e.message || String(e));
    }
  }, [handle]);

  // Subscribe to store changes; debounce writes.
  useEffect(() => {
    if (!handle) return undefined;
    const unsub = onDataChange(() => {
      if (suspendSave.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => doSave(), 250);
    });
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [handle, doSave]);

  const api = {
    supportsFS,
    handle,
    handleName: handle?.name || "",
    status,
    error,
    isPortable: Boolean(handle),

    async openExisting() {
      setError("");
      try {
        const h = await pickExistingFile();
        setHandle(h);
        const data = await readFileHandle(h);
        if (data) {
          suspendSave.current = true;
          importAll(data);
          suspendSave.current = false;
          onDataImported && onDataImported();
        } else {
          // File is empty — write current data as its initial content.
          await writeFileHandle(h, exportAll());
        }
      } catch (e) {
        if (e && e.name === "AbortError") return;
        setError(e.message || String(e));
      }
    },

    async createNew() {
      setError("");
      try {
        const h = await pickNewFile();
        setHandle(h);
        await writeFileHandle(h, exportAll());
      } catch (e) {
        if (e && e.name === "AbortError") return;
        setError(e.message || String(e));
      }
    },

    async detach() {
      await clearFileHandle();
      setHandle(null);
      setStatus("idle");
    },

    async saveNow() {
      await doSave();
    },

    exportDownload() {
      downloadJson(exportAll(), "vpg-daten.json");
    },

    async importClassic() {
      setError("");
      try {
        const data = await pickFileClassic();
        if (!data) return;
        suspendSave.current = true;
        importAll(data);
        suspendSave.current = false;
        onDataImported && onDataImported();
      } catch (e) {
        setError(e.message || String(e));
      }
    },
  };

  return (
    <PortableContext.Provider value={api}>{children}</PortableContext.Provider>
  );
}

export function usePortable() {
  const ctx = useContext(PortableContext);
  if (!ctx) throw new Error("usePortable must be used inside PortableProvider");
  return ctx;
}
