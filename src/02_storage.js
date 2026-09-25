/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — storage: API key (local / session), designed-voice cache,
   preferences, history (IndexedDB). Every access is wrapped: private windows and blocked
   site data must not break the page.
   ============================================================ */
(() => {
'use strict';

const KEY_NAME = 'namari.apikey';
const VOICES_NAME = 'namari.voices.v1';
const PREFS_NAME = 'namari.prefs.v1';

const area = mode => { try { return mode === 'session' ? window.sessionStorage : window.localStorage; } catch (e) { return null; } };
const read = (mode, name) => { try { const s = area(mode); return s ? s.getItem(name) : null; } catch (e) { return null; } };
const write = (mode, name, value) => { try { const s = area(mode); if (!s) return false; s.setItem(name, value); return true; } catch (e) { return false; } };
const remove = (mode, name) => { try { const s = area(mode); if (s) s.removeItem(name); } catch (e) { /* ignore */ } };
const readJson = (name, def) => { try { const v = JSON.parse(read('local', name) || 'null'); return v && typeof v === 'object' ? v : def; } catch (e) { return def; } };

/* ---------------- API key ---------------- */
N.apiKey = {
  /* the tab-scoped key wins when both exist */
  get() { return (read('session', KEY_NAME) || read('local', KEY_NAME) || '').trim(); },
  mode() { return read('session', KEY_NAME) ? 'session' : read('local', KEY_NAME) ? 'local' : null; },
  save(key, mode) {
    this.clear();
    return write(mode === 'session' ? 'session' : 'local', KEY_NAME, String(key).trim());
  },
  clear() { remove('local', KEY_NAME); remove('session', KEY_NAME); },
  mask(key) { key = String(key || ''); return key.length <= 8 ? '••••' : key.slice(0, 4) + '••••••••' + key.slice(-4); },
  looksValid(key) { return /^[A-Za-z0-9_-]{20,}$/.test(String(key || '').trim()); },
};

/* ---------------- designed voices: "<dialect>:<preset>:<model>" -> {id, name, created} ---------------- */
N.voiceCache = {
  all() { return readJson(VOICES_NAME, {}); },
  get(k) { return this.all()[k] || null; },
  set(k, v) { const m = this.all(); m[k] = v; write('local', VOICES_NAME, JSON.stringify(m)); },
  del(k) { const m = this.all(); delete m[k]; write('local', VOICES_NAME, JSON.stringify(m)); },
  clear() { remove('local', VOICES_NAME); },
};

/* ---------------- preferences (never the text itself) ---------------- */
N.prefs = {
  get() { return readJson(PREFS_NAME, {}); },
  set(patch) { write('local', PREFS_NAME, JSON.stringify(Object.assign(this.get(), patch))); },
};

/* ---------------- history: IndexedDB, newest N.HISTORY_MAX entries ----------------
   entry: {id, created, dialectId, dialectName, voiceLabel, emotionLabel, model, text, duration, cost, bytes (Uint8Array WAV)} */
N.HISTORY_MAX = 20;
const DB_NAME = 'namari', DB_VERSION = 1, STORE = 'history';
let dbPromise = null;
const openDb = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
  let req;
  try { req = window.indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  req.onblocked = () => reject(new Error('IndexedDB blocked'));
}).catch(err => { dbPromise = null; throw err; }));

/* run fn(store) in one transaction; resolves with whatever fn stored in box.value once it commits */
const run = (mode, fn) => openDb().then(db => new Promise((resolve, reject) => {
  const t = db.transaction(STORE, mode);
  const box = {};
  fn(t.objectStore(STORE), box);
  t.oncomplete = () => resolve(box.value);
  t.onerror = () => reject(t.error);
  t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted'));
}));

N.history = {
  available: (() => { try { return !!window.indexedDB; } catch (e) { return false; } })(),
  /* add, then drop the oldest beyond the limit — in the same transaction */
  add(entry) {
    return run('readwrite', (st, box) => {
      st.add(entry).onsuccess = e => {
        box.value = e.target.result;
        st.getAllKeys().onsuccess = ev => {
          const keys = ev.target.result;                 // ascending = oldest first
          for (const k of keys.slice(0, Math.max(0, keys.length - N.HISTORY_MAX))) st.delete(k);
        };
      };
    });
  },
  list() {
    return run('readonly', (st, box) => { st.getAll().onsuccess = e => { box.value = e.target.result.sort((a, b) => b.id - a.id); }; });
  },
  get(id) { return run('readonly', (st, box) => { st.get(id).onsuccess = e => { box.value = e.target.result || null; }; }); },
  del(id) { return run('readwrite', st => { st.delete(id); }); },
  clear() { return run('readwrite', st => { st.clear(); }); },
};
})();
