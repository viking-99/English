// นำเข้าบทเรียนจากไฟล์แยก (หากมีบทเรียนใหม่ เพิ่ม import ที่นี่ได้เลย)
import { lesson01 } from './lessons/01-office.js';
import { lesson02 } from './lessons/02-daily.js';

// รวมบทเรียนทั้งหมดไว้ใน Array
const LESSONS = [lesson01, lesson02];

let currentLesson = LESSONS[0];
let DATA = currentLesson.data;

const $ = id => document.getElementById(id);
const S = speechSynthesis;
let voices = [], idx = 0, runId = 0, paused = false, hidden = false;

/* ---------- สลับบทเรียน ---------- */
function initLessonSelect() {
  const sel = $('lessonSelect');
  if (!sel) return;
  sel.innerHTML = '';
  LESSONS.forEach((l, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = l.title;
    sel.appendChild(opt);
  });
  
  sel.onchange = (e) => {
    stop();
    const selectedIdx = e.target.value;
    currentLesson = LESSONS[selectedIdx];
    DATA = currentLesson.data;
    idx = 0;
    $('lessonTitle').textContent = currentLesson.title;
    render();
  };
}

/* ---------- จำค่าตั้ง ---------- */
const KEYS = ['vQ', 'vA', 'vT', 'pQ', 'pA', 'r1', 'r2', 'rep', 'sil', 'dly'];
const CHK = ['thOn', 'auto'];

function saveCfg() {
  const o = {};
  KEYS.forEach(k => o[k] = $(k).value);
  CHK.forEach(k => o[k] = $(k).checked);
  try { localStorage.setItem('cfg01', JSON.stringify(o)); } catch (e) {}
}

function loadCfg() {
  let o; try { o = JSON.parse(localStorage.getItem('cfg01') || '{}'); } catch (e) { o = {}; }
  KEYS.forEach(k => {
    if (o[k] !== undefined && $(k)) {
      const el = $(k);
      if (el.tagName === 'SELECT') { if ([...el.options].some(x => x.value === o[k])) el.value = o[k]; }
      else el.value = o[k];
    }
  });
  CHK.forEach(k => { if (o[k] !== undefined) $(k).checked = o[k]; });
  syncVals(); updateEta();
}

/* ---------- โหลดเสียง ---------- */
function loadVoices() {
  voices = S.getVoices(); if (!voices.length) return;
  const th = voices.filter(v => v.lang.toLowerCase().startsWith('th'));
  const en = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  fill($('vQ'), en); fill($('vA'), en); fill($('vT'), th);
  if (en.length > 1) $('vA').selectedIndex = 1;
  const st = $('voiceStatus');
  if (!th.length) {
    st.className = 'box warn';
    st.innerHTML = '⚠️ <b>ไม่พบเสียงไทย</b> — เสียงอังกฤษใช้ได้ ' + en.length + ' เสียง · ปิดสวิตช์ "เปิดเสียงไทย" หรือติดตั้ง Thai TTS';
  } else {
    st.className = 'box ok';
    st.innerHTML = '✅ พร้อม — อังกฤษ <b>' + en.length + '</b> เสียง · ไทย <b>' + th.length + '</b> เสียง';
  }
  loadCfg();
}

function fill(sel, arr) {
  const cur = sel.value; sel.innerHTML = '';
  arr.forEach(v => {
    const o = document.createElement('option');
    o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')'; sel.appendChild(o);
  });
  if (cur && [...sel.options].some(x => x.value === cur)) sel.value = cur;
}

S.onvoiceschanged = loadVoices; loadVoices(); setTimeout(loadVoices, 600); setTimeout(loadVoices, 1800);

/* ---------- พูด / รอ ---------- */
function say(text, name, lang, rate, pitch) {
  return new Promise(res => {
    if (!text) return res();
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find(x => x.name === name);
    if (v) u.voice = v; u.lang = v ? v.lang : lang;
    u.rate = rate; u.pitch = pitch;
    u.onend = res; u.onerror = res;
    S.speak(u);
  });
}

const wait = ms => new Promise(res => {
  let el = 0;
  const iv = setInterval(() => { if (!paused) el += 100; if (el >= ms) { clearInterval(iv); res(); } }, 100);
});

function hl(id) {
  document.querySelectorAll('.line').forEach(e => e.classList.remove('hl'));
  if (id) $(id).classList.add('hl');
}

function focusSide(which) {
  $('sideQ').classList.toggle('dim', which === 'a');
  $('sideA').classList.toggle('dim', which === 'q');
  if (!which) { $('sideQ').classList.remove('dim'); $('sideA').classList.remove('dim'); }
}

/* ---------- แสดงผล ---------- */
function render() {
  const d = DATA[idx];
  $('qTh').textContent = d.qTh; $('qEn').textContent = d.qEn; $('qPh').textContent = d.qPh;
  $('aTh').textContent = d.aTh; $('aEn').textContent = d.aEn; $('aPh').textContent = d.aPh;
  $('pos').textContent = 'การ์ด ' + (idx + 1) + ' / ' + DATA.length;
  $('fill').style.width = ((idx + 1) / DATA.length * 100) + '%';
  $('repQ').textContent = ''; $('repA').textContent = '';
  applyHide(); hl(null); focusSide(null); updateEta();
}

function applyHide() { ['qEn', 'qPh', 'aEn', 'aPh'].forEach(i => $(i).classList.toggle('hide', hidden)); }

function updateEta() {
  const rep = +$('rep').value, sil = +$('sil').value, dly = +$('dly').value;
  const per = (rep * 2.6 + sil + 1.8) * 2 + dly + ($('thOn').checked ? 3.4 : 0);
  const left = Math.round(per * (DATA.length - idx) / 60);
  $('eta').textContent = '~' + Math.max(1, left) + ' นาที · ' + Math.round(per) + ' วิ/การ์ด';
}

/* ---------- ช่วงเงียบ ---------- */
async function silence() {
  const sec = +$('sil').value;
  $('silence').style.display = 'block';
  for (let i = sec; i > 0; i--) { $('ring').textContent = i; await wait(1000); }
  $('silence').style.display = 'none';
}

/* ---------- FLOW ---------- */
async function playCard() {
  const my = ++runId; paused = false; $('pauseTag').style.display = 'none';
  const d = DATA[idx];
  const vt = $('vT').value, r1 = +$('r1').value, r2 = +$('r2').value;
  const rep = +$('rep').value, thOn = $('thOn').checked;
  const ok = () => my === runId;
  const speed = n => (rep >= 3 && n === 2) ? r2 : (rep === 2 && n === 2 ? r2 : r1);

  async function block(th, en, thId, enId, voice, pitch, tagId, side) {
    focusSide(side);
    if (thOn) { hl(thId); await say(th, vt, 'th-TH', 1, 1); if (!ok()) return false; }
    for (let n = 1; n <= rep; n++) {
      $(tagId).textContent = 'รอบ ' + n + '/' + rep + (speed(n) === r2 ? ' · ช้า' : '');
      hl(enId); await say(en, voice, 'en-US', speed(n), pitch); if (!ok()) return false;
      if (n < rep) { await wait(300); if (!ok()) return false; }
    }
    $(tagId).textContent = '';
    hl(null); await silence();
    return ok();
  }

  if (!await block(d.qTh, d.qEn, 'qTh', 'qEn', $('vQ').value, +$('pQ').value, 'repQ', 'q')) return;
  if (!await block(d.aTh, d.aEn, 'aTh', 'aEn', $('vA').value, +$('pA').value, 'repA', 'a')) return;

  focusSide(null);
  await wait(+$('dly').value * 1000); if (!ok()) return;
  if ($('auto').checked && idx < DATA.length - 1) { idx++; render(); playCard(); }
  else if ($('auto').checked) { $('pos').textContent = '🎉 จบครบ ' + DATA.length + ' การ์ด'; $('eta').textContent = ''; }
}

/* ---------- ควบคุม ---------- */
function stop() {
  runId++; paused = false; S.cancel();
  $('silence').style.display = 'none'; $('pauseTag').style.display = 'none';
  $('btnPause').textContent = '⏸'; hl(null); focusSide(null);
  $('repQ').textContent = ''; $('repA').textContent = '';
}

function togglePause() {
  paused = !paused;
  if (paused) { S.pause(); $('btnPause').textContent = '▶️'; $('pauseTag').style.display = 'block'; }
  else { S.resume(); $('btnPause').textContent = '⏸'; $('pauseTag').style.display = 'none'; }
}

$('btnPlay').onclick = () => { stop(); setTimeout(playCard, 120); };
$('btnStop').onclick = stop;
$('btnPause').onclick = togglePause;
$('btnPrev').onclick = () => { stop(); if (idx > 0) idx--; render(); };
$('btnNext').onclick = () => { stop(); if (idx < DATA.length - 1) idx++; render(); };
$('btnHide').onclick = () => { hidden = !hidden; applyHide(); };

let lpTimer = null;
$('card').addEventListener('pointerdown', () => { lpTimer = setTimeout(togglePause, 500); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
  $('card').addEventListener(ev, () => clearTimeout(lpTimer)));

const tap = (id, txt, vid, lang, rate, pitch) => $(id).onclick = () => {
  stop(); hl(id); say(DATA[idx][txt], $(vid).value, lang, rate(), pitch());
};
tap('qTh', 'qTh', 'vT', 'th-TH', () => 1, () => 1);
tap('aTh', 'aTh', 'vT', 'th-TH', () => 1, () => 1);
tap('qEn', 'qEn', 'vQ', 'en-US', () => +$('r1').value, () => +$('pQ').value);
tap('aEn', 'aEn', 'vA', 'en-US', () => +$('r1').value, () => +$('pA').value);

document.querySelectorAll('.test').forEach(b => b.onclick = () => {
  stop(); const t = b.dataset.t;
  if (t === 'q') say("Hello, how are you today?", $('vQ').value, 'en-US', +$('r1').value, +$('pQ').value);
  if (t === 'a') say("I'm doing great, thank you.", $('vA').value, 'en-US', +$('r1').value, +$('pA').value);
  if (t === 't') say("ทดสอบเสียงภาษาไทย หนึ่ง สอง สาม", $('vT').value, 'th-TH', 1, 1);
});

const SL = [['pQ', 'pQv', ''], ['pA', 'pAv', ''], ['r1', 'r1v', ''], ['r2', 'r2v', ''],
            ['rep', 'repv', ' รอบ'], ['sil', 'silv', 's'], ['dly', 'dlyv', 's']];
function syncVals() { SL.forEach(([a, b, u]) => $(b).textContent = $(a).value + u); }
SL.forEach(([a, b, u]) => $(a).oninput = () => { $(b).textContent = $(a).value + u; updateEta(); saveCfg(); });
[...KEYS, ...CHK].forEach(k => $(k).addEventListener('change', () => { updateEta(); saveCfg(); }));
$('btnReset').onclick = () => { try { localStorage.removeItem('cfg01'); } catch (e) {}; location.reload(); };

// เรียกใช้ฟังก์ชันเริ่มต้น
initLessonSelect();
syncVals();
render();