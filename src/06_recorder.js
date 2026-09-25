/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — recorder: microphone capture (MediaRecorder) with a live level,
   and any browser-decodable audio -> 24 kHz mono 16-bit WAV
   (the format the docs recommend for Voice replication)
   ============================================================ */
(() => {
'use strict';

const RATE = 24000;
N.REC_RATE = RATE;
N.micSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

/* decode -> mono 24 kHz -> trim leading / trailing silence -> WAV.
   returns {bytes, duration, peak, truncated}; throws Error with a Japanese message */
N.toVoiceWav = async (arrayBuffer, { maxSec = 0 } = {}) => {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  let buf;
  try { buf = await new OAC(1, 1, RATE).decodeAudioData(arrayBuffer.slice(0)); }   // decodes and resamples to 24 kHz
  catch (e) { throw new Error('この音声は読み込めませんでした。WAV・MP3・M4A などの音声ファイルを使ってください。'); }
  const n = buf.length, chs = buf.numberOfChannels;
  let x = new Float32Array(n);
  for (let c = 0; c < chs; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) x[i] += d[i] / chs; }

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak < 0.003) throw new Error('音が入っていないようです。マイクの設定（入力デバイス・音量）を確認してください。');

  const win = Math.round(RATE * 0.02), thr = Math.max(0.006, peak * 0.04);
  const loud = i => { let s = 0, m = 0; for (let j = Math.max(0, i); j < Math.min(i + win, n); j++, m++) s += x[j] * x[j]; return m && Math.sqrt(s / m) > thr; };
  let a = 0, b = n;
  while (a < n && !loud(a)) a += win;
  while (b > a && !loud(b - win)) b -= win;
  const pad = Math.round(RATE * 0.25);
  x = x.subarray(Math.max(0, a - pad), Math.min(n, b + pad));

  let truncated = false;
  if (maxSec && x.length > maxSec * RATE) { x = x.subarray(0, maxSec * RATE); truncated = true; }
  return { bytes: N.floatToWav(x, RATE), duration: x.length / RATE, peak, truncated };
};

/* microphone recorder: start() -> stop() resolves with the recorded Blob */
N.Recorder = class {
  constructor({ maxSec = 30, onLevel, onAutoStop } = {}) {
    this.maxSec = maxSec;
    this.onLevel = onLevel;
    this.onAutoStop = onAutoStop;
    this.mr = null;
  }
  get recording() { return !!this.mr && this.mr.state === 'recording'; }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']
      .find(t => window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    this.mr = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    this.mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    this.done = new Promise(resolve => { this.mr.onstop = () => resolve(new Blob(chunks, { type: this.mr.mimeType || type || 'audio/webm' })); });

    const AC = window.AudioContext || window.webkitAudioContext;
    this.ac = new AC();
    const an = this.ac.createAnalyser();
    an.fftSize = 1024;
    this.ac.createMediaStreamSource(this.stream).connect(an);
    const data = new Float32Array(an.fftSize);

    this.t0 = performance.now();
    this.mr.start(250);
    this.timer = setTimeout(() => { if (this.recording) this.stop().then(blob => { if (this.onAutoStop) this.onAutoStop(blob); }); }, this.maxSec * 1000);
    const tick = () => {
      if (!this.recording) return;
      an.getFloatTimeDomainData(data);
      let s = 0;
      for (let i = 0; i < data.length; i++) s += data[i] * data[i];
      if (this.onLevel) this.onLevel(Math.sqrt(s / data.length), (performance.now() - this.t0) / 1000);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  async stop() {
    if (!this.mr) return null;
    clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
    if (this.mr.state !== 'inactive') this.mr.stop();
    for (const t of this.stream.getTracks()) t.stop();
    try { this.ac.close(); } catch (e) { /* already closed */ }
    const blob = await this.done;
    this.mr = null;
    return blob;
  }
};

/* rolling level bars for the recorder (newest on the right) */
N.drawLevels = (canvas, levels) => {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const css = getComputedStyle(canvas);
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, css.getPropertyValue('--g1').trim() || '#7c3aed');
  grad.addColorStop(1, css.getPropertyValue('--g2').trim() || '#06b6d4');
  const bar = 3, gap = 2, count = Math.floor((w + gap) / (bar + gap));
  const recent = levels.slice(-count);
  g.fillStyle = css.getPropertyValue('--wave').trim() || '#888';
  g.fillRect(0, h / 2 - 0.5, w, 1);
  g.fillStyle = grad;
  recent.forEach((lv, i) => {
    const bh = Math.max(2, Math.min(1, lv * 5) * (h - 4));
    const x = w - (recent.length - i) * (bar + gap);
    g.fillRect(x, (h - bh) / 2, bar, bh);
  });
};
})();
