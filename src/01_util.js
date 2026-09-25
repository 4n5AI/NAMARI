/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — util: base64, WAV parsing / wrapping, tags, misc
   ============================================================ */
'use strict';
const N = (window.N = window.N || {});

N.sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal && signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
  const t = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/* ---- base64 ---- */
N.b64ToBytes = b64 => {
  const bin = atob(String(b64 || '').replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

N.bytesToB64 = bytes => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/* ---- WAV ---- */
const ascii = (b, o, n) => String.fromCharCode(...b.subarray(o, o + n));

/* RIFF/WAVE -> {sampleRate, channels, bits, dataOffset, dataLength, duration} or null */
N.parseWav = bytes => {
  if (!bytes || bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fmt = null, o = 12;
  while (o + 8 <= bytes.length) {
    const id = ascii(bytes, o, 4);
    let size = dv.getUint32(o + 4, true);
    if (id === 'fmt ') {
      fmt = { format: dv.getUint16(o + 8, true), channels: dv.getUint16(o + 10, true), sampleRate: dv.getUint32(o + 12, true), bits: dv.getUint16(o + 22, true) };
    } else if (id === 'data') {
      if (!fmt) return null;
      // streaming-style headers may carry 0 / 0xFFFFFFFF as the size: trust the actual byte count
      const avail = bytes.length - (o + 8);
      if (size === 0 || size > avail) size = avail;
      const bytesPerSec = fmt.sampleRate * fmt.channels * (fmt.bits / 8);
      return Object.assign(fmt, { dataOffset: o + 8, dataLength: size, duration: bytesPerSec ? size / bytesPerSec : 0 });
    }
    o += 8 + size + (size & 1);
  }
  return null;
};

/* 16-bit PCM -> WAV bytes (used for audio/l16 responses and to repair broken headers) */
N.pcmToWav = (pcm, sampleRate = 24000, channels = 1) => {
  const out = new Uint8Array(44 + pcm.length);
  const dv = new DataView(out.buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE');
  w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, channels, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * channels * 2, true);
  dv.setUint16(32, channels * 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
};

/* Float32 mono samples (-1..1) -> 16-bit WAV bytes */
N.floatToWav = (samples, sampleRate) => {
  const pcm = new Uint8Array(samples.length * 2);
  const dv = new DataView(pcm.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return N.pcmToWav(pcm, sampleRate, 1);
};

/* API audio bytes -> {bytes (a well-formed WAV), info} */
N.toWav = (bytes, mime) => {
  const info = N.parseWav(bytes);
  if (info) {
    if (info.format !== 1 || info.bits !== 16) return { bytes, info };           // leave unusual encodings untouched
    const pcm = bytes.subarray(info.dataOffset, info.dataOffset + info.dataLength);
    const fixed = N.pcmToWav(pcm, info.sampleRate, info.channels);             // normalises the RIFF sizes
    return { bytes: fixed, info: N.parseWav(fixed) };
  }
  const m = /rate=(\d+)/.exec(mime || '');
  const wav = N.pcmToWav(bytes, m ? +m[1] : 24000, 1);                         // headerless audio/l16
  return { bytes: wav, info: N.parseWav(wav) };
};

/* ---- inline tags: <laugh> <short pause> ... ---- */
N.TAG_RE = /<[a-z][a-z -]*>/gi;
N.extractTags = text => (String(text || '').match(N.TAG_RE) || []).map(t => t.toLowerCase());
/* tags that went missing or appeared between two texts (order-insensitive multiset diff) */
N.diffTags = (before, after) => {
  const count = arr => arr.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map());
  const a = count(N.extractTags(before)), b = count(N.extractTags(after));
  const missing = [], added = [];
  for (const [t, n] of a) for (let i = (b.get(t) || 0); i < n; i++) missing.push(t);
  for (const [t, n] of b) for (let i = (a.get(t) || 0); i < n; i++) added.push(t);
  return { missing, added, ok: !missing.length && !added.length };
};

/* ---- logging helpers ---- */
/* deep copy that replaces long base64 payloads with a short summary (for logs) */
N.redact = (v, depth = 0) => {
  if (depth > 12) return '…';
  if (typeof v === 'string') return v.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(v.slice(0, 200)) ? `<base64 ${v.length} chars>` : v;
  if (Array.isArray(v)) return v.map(x => N.redact(x, depth + 1));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = N.redact(v[k], depth + 1); return o; }
  return v;
};

N.fmtSec = s => (s >= 60 ? `${Math.floor(s / 60)}分${(s % 60).toFixed(0).padStart(2, '0')}秒` : `${s.toFixed(1)}秒`);
N.fmtBytes = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(0) + ' KB' : n + ' B');
N.stamp = (d = new Date()) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), '-', d.getHours(), d.getMinutes(), d.getSeconds()]
  .map(x => (typeof x === 'number' ? String(x).padStart(2, '0') : x)).join('');
