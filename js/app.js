import { lesson01 } from './lessons/01-office.js';
import { lesson02 } from './lessons/02-daily.js';

const LESSONS = [lesson01, lesson02];
let currentLesson = LESSONS[0];
let DATA = currentLesson.data;

const $ = id => document.getElementById(id);
let idx = 0, runId = 0, paused = false, hidden = false;
let currentAudio = null;

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
    currentLesson = LESSONS[e.target.value];
    DATA = currentLesson.data;
    idx = 0;
    $('lessonTitle').textContent = currentLesson.title;
    render();
  };
}

/* ---------- ระบบเล่นไฟล์ MP3 ---------- */
function playAudio(src) {
  return new Promise((resolve) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const audio = new Audio(src);
    currentAudio = audio;

    // ตั้งค่า Media Session สำหรับควบคุมบน Lock Screen
    if ('mediaSession' in navigator) {
      const d = DATA[idx];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: d.qEn,
        artist: currentLesson.title,
        album: `การ์ดที่ ${idx + 1} / ${DATA.length}`
      });
      navigator.mediaSession.setActionHandler('play', () => { if(paused) togglePause(); });
      navigator.mediaSession.setActionHandler('pause', () => { if(!paused) togglePause(); });
      navigator.mediaSession.setActionHandler('nexttrack', () => { stop(); if(idx < DATA.length-1) idx++; render(); playCard(); });
      navigator.mediaSession.setActionHandler('previoustrack', () => { stop(); if(idx > 0) idx--; render(); playCard(); });
    }

    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);

    audio.play().catch(() => resolve(false));
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

function render() {
  const d = DATA[idx];
  $('qTh').textContent = d.qTh; $('qEn').textContent = d.qEn; $('qPh').textContent = d.qPh;
  $('aTh').textContent = d.aTh; $('aEn').textContent = d.aEn; $('aPh').textContent = d.aPh;
  $('pos').textContent = 'การ์ด ' + (idx + 1) + ' / ' + DATA.length;
  $('fill').style.width = ((idx + 1) / DATA.length * 100) + '%';
  applyHide(); hl(null); focusSide(null);
}

function applyHide() { ['qEn', 'qPh', 'aEn', 'aPh'].forEach(i => $(i).classList.toggle('hide', hidden)); }

async function silence() {
  const sec = +$('sil').value;
  $('silence').style.display = 'block';
  for (let i = sec; i > 0; i--) { $('ring').textContent = i; await wait(1000); }
  $('silence').style.display = 'none';
}

/* ---------- ลำดับการเล่นการ์ด ---------- */
async function playCard() {
  const my = ++runId; paused = false; $('pauseTag').style.display = 'none';
  const rep = +$('rep').value, thOn = $('thOn').checked;
  const lessonId = currentLesson.id;
  const ok = () => my === runId;

  async function block(thId, enId, tagId, side, type) {
    focusSide(side);
    const prefix = `audio/${lessonId}_${idx}_${type}`;
    
    if (thOn) {
      hl(thId);
      await playAudio(`${prefix}Th.mp3`);
      if (!ok()) return false;
    }

    for (let n = 1; n <= rep; n++) {
      $(tagId).textContent = 'รอบ ' + n + '/' + rep;
      hl(enId);
      await playAudio(`${prefix}En.mp3`);
      if (!ok()) return false;
      if (n < rep) { await wait(400); if (!ok()) return false; }
    }
    
    $(tagId).textContent = '';
    hl(null); 
    await silence();
    return ok();
  }

  if (!await block('qTh', 'qEn', 'repQ', 'q', 'q')) return;
  if (!await block('aTh', 'aEn', 'repA', 'a', 'a')) return;

  focusSide(null);
  await wait(+$('dly').value * 1000); if (!ok()) return;
  if ($('auto').checked && idx < DATA.length - 1) { idx++; render(); playCard(); }
  else if ($('auto').checked) { $('pos').textContent = '🎉 จบครบ ' + DATA.length + ' การ์ด'; }
}

function stop() {
  runId++; paused = false;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  $('silence').style.display = 'none'; $('pauseTag').style.display = 'none';
  $('btnPause').textContent = '⏸'; hl(null); focusSide(null);
  $('repQ').textContent = ''; $('repA').textContent = '';
}

function togglePause() {
  paused = !paused;
  if (currentAudio) {
    if (paused) currentAudio.pause();
    else currentAudio.play();
  }
  $('btnPause').textContent = paused ? '▶️' : '⏸';
  $('pauseTag').style.display = paused ? 'block' : 'none';
}

$('btnPlay').onclick = () => { stop(); setTimeout(playCard, 100); };
$('btnStop').onclick = stop;
$('btnPause').onclick = togglePause;
$('btnPrev').onclick = () => { stop(); if (idx > 0) idx--; render(); };
$('btnNext').onclick = () => { stop(); if (idx < DATA.length - 1) idx++; render(); };
$('btnHide').onclick = () => { hidden = !hidden; applyHide(); };

initLessonSelect();
render();