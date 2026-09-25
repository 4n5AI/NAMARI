/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — waveform: peaks from 16-bit WAV, Canvas 2D bars,
   progress / playhead synced to an <audio>, click / keys to seek
   ============================================================ */
(() => {
'use strict';

/* 16-bit PCM WAV -> {peaks: Float32Array [min,max,...] per bucket, duration} */
N.wavPeaks = (bytes, buckets = 1000) => {
  const info = N.parseWav(bytes);
  if (!info || info.format !== 1 || info.bits !== 16 || !info.dataLength) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset + info.dataOffset, info.dataLength);
  const stride = 2 * info.channels;
  const frames = Math.floor(info.dataLength / stride);
  const n = Math.max(1, Math.min(buckets, frames));
  const peaks = new Float32Array(n * 2);
  for (let b = 0; b < n; b++) {
    const s = Math.floor((b * frames) / n), e = Math.max(s + 1, Math.floor(((b + 1) * frames) / n));
    let mn = 0, mx = 0;
    for (let i = s; i < e; i++) {
      const v = dv.getInt16(i * stride, true) / 32768;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    peaks[b * 2] = mn;
    peaks[b * 2 + 1] = mx;
  }
  return { peaks, duration: info.duration };
};

const BAR = 3, GAP = 2;                              // CSS px

N.Waveform = class {
  constructor(canvas, audio) {
    this.c = canvas;
    this.a = audio;
    this.data = null;
    this.raf = 0;
    const redraw = () => this.draw();
    const loop = () => { this.draw(); this.raf = this.a.paused ? 0 : requestAnimationFrame(loop); };
    audio.addEventListener('play', () => { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(loop); });
    for (const ev of ['pause', 'ended', 'seeked', 'timeupdate', 'loadedmetadata']) audio.addEventListener(ev, redraw);
    canvas.addEventListener('pointerdown', e => {
      const d = this.duration();
      if (!d) return;
      const r = canvas.getBoundingClientRect();
      this.seek(((e.clientX - r.left) / r.width) * d);
    });
    canvas.addEventListener('keydown', e => {
      const d = this.duration();
      if (!d) return;
      const t = this.a.currentTime;
      const to = { ArrowLeft: t - 1, ArrowRight: t + 1, Home: 0, End: d }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      this.seek(to);
    });
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(canvas);
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', redraw);
    }
  }
  duration() { return (isFinite(this.a.duration) && this.a.duration) || (this.data && this.data.duration) || 0; }
  seek(t) {
    const d = this.duration();
    this.a.currentTime = Math.max(0, Math.min(d, t));
    this.draw();
  }
  set(bytes) { this.data = N.wavPeaks(bytes); this.draw(); }
  clear() { this.data = null; this.draw(); }
  draw() {
    const c = this.c, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const css = getComputedStyle(c);
    const col = name => css.getPropertyValue(name).trim() || '#888';
    const d = this.duration();
    const progress = d ? Math.min(1, this.a.currentTime / d) : 0;
    c.setAttribute('aria-valuemax', d.toFixed(1));
    c.setAttribute('aria-valuenow', (progress * d).toFixed(1));
    c.setAttribute('aria-valuetext', `${N.fmtSec(progress * d)} / ${N.fmtSec(d)}`);

    const mid = h / 2;
    if (!this.data) {
      g.fillStyle = col('--wave');
      g.fillRect(0, mid - 0.5, w, 1);
      return;
    }
    const { peaks } = this.data, buckets = peaks.length / 2;
    let top = 0;
    for (let i = 0; i < peaks.length; i++) top = Math.max(top, Math.abs(peaks[i]));
    const gain = top > 0 ? Math.min(1 / top, 8) : 1;          // quiet takes still read as a shape
    const bars = Math.max(1, Math.floor((w + GAP) / (BAR + GAP)));
    const played = g.createLinearGradient(0, 0, w, 0), rest = col('--wave');   // played part carries the voice signal gradient
    played.addColorStop(0, col('--g1'));
    played.addColorStop(1, col('--g2'));
    for (let i = 0; i < bars; i++) {
      const s = Math.floor((i * buckets) / bars), e = Math.max(s + 1, Math.floor(((i + 1) * buckets) / bars));
      let amp = 0;
      for (let b = s; b < e; b++) amp = Math.max(amp, -peaks[b * 2], peaks[b * 2 + 1]);
      const bh = Math.max(2, amp * gain * (h - 6));
      g.fillStyle = (i + 0.5) / bars <= progress ? played : rest;
      const x = i * (BAR + GAP);
      if (g.roundRect) { g.beginPath(); g.roundRect(x, mid - bh / 2, BAR, bh, 1.5); g.fill(); }
      else g.fillRect(x, mid - bh / 2, BAR, bh);
    }
    if (progress > 0 && progress < 1) {
      g.fillStyle = col('--wave-head');
      g.fillRect(Math.round(progress * w) - 1, 0, 2, h);
    }
  }
};
})();
