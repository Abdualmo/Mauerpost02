// Portable-mode sync: keep the app's data in a single JSON file on disk
// (e.g. on a USB stick) so it travels with the stick.
//
// Uses the File System Access API where available (Chrome/Edge/Opera) to
// remember a chosen file across sessions via IndexedDB and to auto-save
// on every change.
//
// Import/Export via the classic file input / download works everywhere as a
// fallback and for backups.

const DB_NAME = "vpg-portable";
const STORE = "handles";
const KEY_FILE = "dataFile";

export function hasFileSystemAccess() {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

async function idbDelete(key) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

export async function restoreFileHandle() {
  if (!hasFileSystemAccess()) return null;
  const handle = await idbGet(KEY_FILE);
  if (!handle) return null;
  try {
    // Check current permission
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") return handle;
    // Not yet granted — return the handle; the caller can trigger a
    // request on the next user gesture.
    return handle;
  } catch {
    return null;
  }
}

export async function ensurePermission(handle) {
  if (!handle) return false;
  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm === "granted") return true;
  const req = await handle.requestPermission({ mode: "readwrite" });
  return req === "granted";
}

export async function pickExistingFile() {
  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: "VacationPlanner Datendatei",
        accept: { "application/json": [".json"] },
      },
    ],
    excludeAcceptAllOption: false,
    multiple: false,
  });
  await idbSet(KEY_FILE, handle);
  return handle;
}

export async function pickNewFile(suggestedName = "vpg-daten.json") {
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: "VacationPlanner Datendatei",
        accept: { "application/json": [".json"] },
      },
    ],
  });
  await idbSet(KEY_FILE, handle);
  return handle;
}

export async function readFileHandle(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Datei enthält kein gültiges JSON.");
  }
}

export async function writeFileHandle(handle, data) {
  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(data, null, 2));
  } finally {
    await writable.close();
  }
}

export async function clearFileHandle() {
  await idbDelete(KEY_FILE);
}

// Classic download fallback
export function downloadJson(data, filename = "vpg-daten.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFileClassic() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result || "")));
        } catch {
          reject(new Error("Datei enthält kein gültiges JSON."));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}

export function fileHandleName(handle) {
  if (!handle) return "";
  return handle.name || "";
}
