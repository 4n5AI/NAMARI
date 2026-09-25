/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — PWA: service worker registration, 「アプリとして入れる」 button
   (in the settings dialog, 設定 tab)
   - Chrome / Edge / Android: the browser's own install prompt (beforeinstallprompt)
   - iPhone / iPad, Mac Safari: step-by-step instructions (no prompt API there)
   - hidden when already running as an app or when the browser cannot install
   ============================================================ */
(() => {
'use strict';
if (!document.getElementById('app')) return;
const $ = id => document.getElementById(id);

/* ---------- service worker (https or localhost only) ---------- */
const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && secure) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { /* private mode etc.: the page still works online */ });
  });
}

/* ---------- where are we? ---------- */
const ua = navigator.userAgent || '';
const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);   // iPadOS reports a Mac UA
const isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|OPR\//.test(ua);
const GUIDES = {
  ios: {
    steps: ['画面下（iPad は右上）の共有ボタン（□に↑のマーク）を押します。', '「ホーム画面に追加」を選びます（見当たらないときは、メニューを下にスクロールします）。', '右上の「追加」を押すと、ホーム画面に NAMARI が入ります。'],
    note: 'ホーム画面から開いたアプリは、Safari とは保存場所が別になります。アプリ側で APIキーをもう一度入力してください。',
  },
  mac: {
    steps: ['メニューバーの「ファイル」→「Dockに追加」を選びます。', '「追加」を押すと、Dock と Launchpad に NAMARI が入ります。'],
    note: 'アプリとして開くと、アドレスバーのない専用ウインドウで使えます。',
  },
};

let deferred = null;                                           // the saved beforeinstallprompt event
function refresh() {
  const can = !standalone() && (!!deferred || isIOS || isMacSafari);
  $('btnInstall').hidden = !can;
  $('installHelpState').textContent = standalone() ? 'いまはアプリとして開いています。'
    : can ? '' : 'インストール済みか、このブラウザではここから入れられません。Chrome・Edge・Safari で開くか、ブラウザのメニューから入れてください。';
}
function showGuide(kind) {
  const g = GUIDES[kind];
  const list = $('installSteps');
  list.textContent = '';
  for (const s of g.steps) { const li = document.createElement('li'); li.textContent = s; list.append(li); }
  $('installNote').textContent = g.note;
  $('dlgInstall').showModal();
}
async function install() {
  if (deferred) {
    const ev = deferred;
    deferred = null;                                             // a prompt can only be shown once
    ev.prompt();
    try { await ev.userChoice; } catch (e) { /* dismissed */ }
    refresh();
    return;
  }
  if (isIOS) showGuide('ios');
  else if (isMacSafari) showGuide('mac');
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
window.addEventListener('appinstalled', () => {
  deferred = null;
  refresh();
  $('installDone').textContent = 'インストールしました。ホーム画面・デスクトップ・アプリ一覧から開けます。';
  $('installDone').className = 'note ok';
});
if (window.matchMedia) {
  const mq = matchMedia('(display-mode: standalone)');
  if (mq.addEventListener) mq.addEventListener('change', refresh);
}
$('btnInstall').addEventListener('click', install);
$('btnInstallClose').addEventListener('click', () => $('dlgInstall').close());

/* ---------- online / offline ---------- */
function net() {
  const n = $('netNote');
  if (navigator.onLine) { n.textContent = ''; n.className = 'note'; return; }
  n.textContent = 'オフラインです。履歴の再生・保存と動画の書き出しは使えます。変換と読み上げは、ネットにつながると使えます。';
  n.className = 'note warn';
}
window.addEventListener('online', net);
window.addEventListener('offline', net);
net();
refresh();
})();
