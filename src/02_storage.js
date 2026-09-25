/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — storage: API key (local / session), designed-voice cache,
   preferences. Every access is wrapped: private windows and blocked
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
})();
