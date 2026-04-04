/**
 * Simple IndexedDB wrapper for persisting project data across browser refreshes.
 * No external dependencies — uses raw IndexedDB API.
 */

const DB_NAME = "roblox-forge";
const DB_VERSION = 1;
const STORE_NAME = "project-data";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToStorage(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn("IndexedDB save failed:", e);
  }
}

export async function loadFromStorage<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => { db.close(); resolve(request.result ?? null); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (e) {
    console.warn("IndexedDB load failed:", e);
    return null;
  }
}

export async function deleteFromStorage(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn("IndexedDB delete failed:", e);
  }
}

export async function getAllKeys(): Promise<string[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => { db.close(); resolve(request.result as string[]); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (e) {
    console.warn("IndexedDB getAllKeys failed:", e);
    return [];
  }
}
