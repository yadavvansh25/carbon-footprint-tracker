/**
 * @fileoverview Footprint — EcoTrack-style complete app logic
 *
 * Sections:
 * 1. Config & state
 * 2. Persistence (localStorage)
 * 3. Toast
 * 4. Form / API
 * 5. Dashboard rendering (top stats, trackers)
 * 6. Action Tracker Hub (checklist + custom commitments)
 * 7. Badge Milestones
 * 8. Weekly Trends chart
 * 9. Semi-circle Annual Footprint chart
 * 10. Interactive Assessment sliders
 * 11. Voice Assistant (Web Speech API)
 * 12. Gemini AI Advisor (re-summarise habit_analysis)
 * 13. Init
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// 1. CONFIG & CONSTANTS
// ═══════════════════════════════════════════════════════════════

// Updated API_BASE for Vercel deployment (uses relative path)
const API_BASE     = '';
const LS_WEEKLY    = 'fp_eco_weekly_v1';
const LS_STREAK    = 'fp_eco_streak_v1';
const LS_LAST      = 'fp_eco_last_v1';
const LS_ACTIONS   = 'fp_eco_actions_v1';
const LS_CUSTOM    = 'fp_eco_custom_v1';
const LS_ASSESS    = 'fp_eco_assess_v1';
const LS_TOURED    = 'fp_eco_toured_v1';
const TREE_ABSORB  = 21.8;   // kg CO₂ / year / tree
const US_AVG       = 16.0;   // tons/year

// Example quick fills
const EXAMPLES = {
  'car-burger':  'Drove 15km to work and back in a petrol car. Had a beef burger for lunch and chicken pasta for dinner. Watched Netflix 2 hours.',
  'cycle-vegan': 'Cycled 8km to the office. Vegan salad for lunch and plant-based curry for dinner. Charged laptop for 5 hours.',
  'flight':      'Long-haul flight London to New York economy class (7 hours). Chicken meal on the plane, vegan dinner in the evening.',
  'wfh-ac':      'Worked from home all day with air conditioning on for 8 hours. Vegetarian pasta lunch. Beef steak dinner. Dishwasher once.',
};

// Category colours matching the EcoTrack palette
const CAT_CLR = {
  food:      { color:'#ff7043', bg:'rgba(255,112,67,.12)',  label:'Food & Diet'  },
  transport: { color:'#40c4ff', bg:'rgba(64,196,255,.12)',  label:'Transport'    },
  energy:    { color:'#a855f7', bg:'rgba(168,85,247,.12)',  label:'Home Energy'  },
  other:     { color:'#64748b', bg:'rgba(100,116,139,.12)', label:'Other'        },
};

// Assessment sliders default config
const ASSESS_DEFAULT = [
  { id:'a-transport', label:'Transportation',  sub:'Personal vehicle & public transit',   unit:'Tons/Yr', min:0, max:6,   step:.1, val:2.8, color:'#40c4ff' },
  { id:'a-food',      label:'Food & Diet',      sub:'Diet type, meat consumption, food waste', unit:'Tons/Yr', min:0, max:5,   step:.1, val:1.8, color:'#ff7043' },
  { id:'a-energy',    label:'Home Energy',      sub:'Electricity & heating bills',         unit:'Tons/Yr', min:0, max:6,   step:.1, val:3.2, color:'#a855f7' },
  { id:'a-shopping',  label:'Shopping & Goods', sub:'Clothing, electronics, consumables',  unit:'Tons/Yr', min:0, max:4,   step:.1, val:1.4, color:'#ffab40' },
  { id:'a-waste',     label:'Waste & Services', sub:'Landfill, recycling, water usage',    unit:'Tons/Yr', min:0, max:3,   step:.1, val:1.2, color:'#ce93d8' },
  { id:'a-flight',    label:'Air Travel',        sub:'Domestic & international flights',   unit:'Tons/Yr', min:0, max:5,   step:.1, val:0.5, color:'#26c6da' },
];

// Badge definitions
const BADGES = [
  { id:'pledge',   icon:'🌐', color:'#5c6bc0', bg:'rgba(92,107,192,.15)', title:'PLEDGE PIONEER',   sub:'CALCULATE FOOTPRINT',  req:'Submit your first carbon footprint analysis.',     cond: s => s.totalLogs >= 1,            saving: 0   },
  { id:'eco-nov',  icon:'💚', color:'#00c853', bg:'rgba(0,200,83,.15)',   title:'ECO NOVICE',       sub:'1+ COMMITTED HABIT',   req:'Commit to at least one daily eco-action.',         cond: s => s.checkedActions >= 1,       saving: 0   },
  { id:'habit',    icon:'🔥', color:'#ff7043', bg:'rgba(255,112,67,.15)', title:'HABIT WARRIOR',    sub:'STREAK >= 5 DAYS',     req:'Maintain a carbon-savvy active streak of 5+ days.',cond: s => s.streak >= 5,               saving: 0   },
  { id:'carbon-c', icon:'🛡️', color:'#ec407a', bg:'rgba(236,64,122,.15)', title:'CARBON CRUSADER',  sub:'SAVE >= 0.5 TONS/YR',  req:'Hit an annual carbon offset rate of over 0.5T.',   cond: s => s.annualSaved >= 0.5,        saving: .5  },
  { id:'champion', icon:'🏆', color:'#ffab40', bg:'rgba(255,171,64,.15)', title:'CLIMATE CHAMPION', sub:'SAVE >= 1.5 TONS/YR',  req:'Achieve direct savings of 1.5 tons of annual offsets.', cond: s => s.annualSaved >= 1.5, saving: 1.5 },
  { id:'forest',   icon:'🌳', color:'#00e676', bg:'rgba(0,230,118,.15)',  title:'FOREST GUARDIAN',  sub:'TREES POWER >= 40/YR', req:'Equivalent saving potential matches 40+ growing saplings.', cond: s => s.treePower >= 40, saving: 0   },
  { id:'titan',    icon:'⚡', color:'#78909c', bg:'rgba(120,144,156,.12)',title:'GREEN TITAN',      sub:'15+ STREAK & 1.0T+ SAVED', req:'Ultimate: 15+ day streak and 1.0 ton CO₂e annual offsets.',cond: s => s.streak>=15 && s.annualSaved>=1, saving:1},
];

// ═══════════════════════════════════════════════════════════════
// 2. STATE
// ═══════════════════════════════════════════════════════════════

const state = {
  weeklyData:   loadLS(LS_WEEKLY, Array(7).fill(0)),
  streak:       +loadLS(LS_STREAK, 0),
  lastDate:     loadLS(LS_LAST, ''),
  checkedIds:   new Set(loadLS(LS_ACTIONS, [])),
  customActions:[],
  currentTips:  [],
  lastAnalysis: null,
  assessVals:   loadLS(LS_ASSESS, ASSESS_DEFAULT.map(a => a.val)),
  totalLogs:    +loadLS('fp_total_logs', 0),
  barChart:     null,
  donutChart:   null,
  footChart:    null,
  speechActive: false,
  utterance:    null,
};

// ═══════════════════════════════════════════════════════════════
// 3. UTILITIES
// ═══════════════════════════════════════════════════════════════

function loadLS(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v !== null ? v : def; }
  catch(_) { return def; }
}
function saveLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
function $id(id) { return document.getElementById(id); }

function fmt(n, dec=2) { return (+n).toFixed(dec); }

// ═══════════════════════════════════════════════════════════════
// 4. TOAST
// ═══════════════════════════════════════════════════════════════

let _tt;
function toast(msg, type='success', ms=3000) {
  const styles = {
    success: 'background:#0e2115;border:1px solid rgba(0,230,118,.3);color:#4ade80',
    error:   'background:#1a0b0b;border:1px solid rgba(239,83,80,.3);color:#f87171',
    info:    'background:#0b1620;border:1px solid rgba(64,196,255,.3);color:#93c5fd',
  };
  $id('toast').setAttribute('style',
    `position:fixed;bottom:24px;right:24px;z-index:9999;padding:11px 18px;border-radius:10px;font-size:.83rem;font-weight:600;max-width:340px;backdrop-filter:blur(16px);${styles[type]}`);
  $id('toast').textContent = msg;
  $id('toast').classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => $id('toast').classList.remove('show'), ms);
}

// ═══════════════════════════════════════════════════════════════
// 5. FORM / API
// ═══════════════════════════════════════════════════════════════

function setLoading(on) {
  $id('log-submit').setAttribute('aria-busy', on);
  $id('log-btn-label').textContent = on ? '⏳ ANALYSING WITH AI…' : '⚡ ANALYSE WITH GEMINI AI';
  $id('log-submit').style.opacity  = on ? '.7' : '1';
  $id('api-status').textContent    = on ? '⏳ PROCESSING' : '● AI READY';
  $id('log-submit').disabled = on;
}
function setErr(msg) {
  $id('log-error').textContent = msg;
  $id('log-error').classList.toggle('hidden', !msg);
  $id('log-input').setAttribute('aria-invalid', !!msg);
}

async function handleSubmit(e) {
  e.preventDefault();
  const text = $id('log-input').value.trim();
  if (!text || text.length < 5) { setErr('Please describe at least one activity (min 5 chars).'); $id('log-input').focus(); return; }
  if (text.length > 500)        { setErr('Max 500 characters.'); return; }
  setErr(''); setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/api/logs/analyse`, {
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ activity_text: text }),
    });
    if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error(e?.detail || `Error ${res.status}`); }
    const data = await res.json();

    state.lastAnalysis = data;
    state.totalLogs++;
    saveLS('fp_total_logs', state.totalLogs);

    // Push to weekly data
    state.weeklyData = [...state.weeklyData.slice(1), data.estimated_co2];
    saveLS(LS_WEEKLY, state.weeklyData);

    updateStreak();
    loadTips(data.actionable_tips, data.categories, data.estimated_co2);
    renderTopStats();
    renderTrackers();
    renderBadges();
    renderTrendChart();
    renderFootprintChart(data.categories, data.estimated_co2);
    renderInsightsReady(data.habit_analysis);

    toast('✨ Analysis complete! Scroll down to explore your dashboard.', 'success');

    // Scroll to tracker hub
    setTimeout(() => $id('tracker').scrollIntoView({ behavior:'smooth', block:'start' }), 150);

  } catch(err) {
    const msg = err.message?.includes('fetch') ? '⚠️ Backend offline? Start FastAPI on port 8000.' : `❌ ${err.message}`;
    toast(msg, 'error', 5000); setErr(err.message);
  } finally {
    setLoading(false);
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. STREAK
// ═══════════════════════════════════════════════════════════════

function updateStreak() {
  const today = new Date().toDateString();
  if (state.lastDate !== today) {
    const diff = state.lastDate
      ? Math.round((new Date(today) - new Date(state.lastDate)) / 86400000)
      : 999;
    state.streak = diff === 1 ? state.streak + 1 : 1;
    state.lastDate = today;
    saveLS(LS_STREAK, state.streak);
    saveLS(LS_LAST, today);
  }

  const badge = $id('streak-badge');
  $id('streak-val').textContent = state.streak;
  if (state.streak >= 2) { badge.classList.remove('hidden'); badge.style.display = 'inline-flex'; }
}

// ═══════════════════════════════════════════════════════════════
// 7. TOP STATS
// ═══════════════════════════════════════════════════════════════

function getDailyKg() {
  return [...state.currentTips, ...state.customActions]
    .filter(t => state.checkedIds.has(t.id))
    .reduce((a,t) => a + (t.co2_saving||0), 0);
}

function renderTopStats() {
  const dailyKg  = getDailyKg();
  const annualT  = (dailyKg * 365) / 1000;
  const trees    = Math.round((dailyKg * 365) / TREE_ABSORB);

  $id('stat-offset').textContent = fmt(annualT, 3);
  $id('stat-trees').textContent  = trees;
  $id('stat-streak').textContent = state.streak;
  $id('stat-streak-sub').textContent = state.streak >= 5 ? `${state.streak} active habits` : state.streak >= 1 ? 'Keep it up!' : 'Start your streak!';

  // Daily savings display in hub
  $id('daily-savings').textContent = fmt(dailyKg, 1);
  $id('annual-savings').textContent = `−${fmt(annualT, 2)} Tons Saved/Year`;

  // Climate standing
  let standing = 'Getting Started';
  if (annualT >= 2)   standing = 'Active Reducer 🌿';
  if (annualT >= 5)   standing = 'Climate Champion 🏆';
  if (annualT >= 0.5 && annualT < 2) standing = 'Eco Committed ✅';
  $id('stat-standing').textContent = standing;
}

// ═══════════════════════════════════════════════════════════════
// 8. TRACKERS ROW
// ═══════════════════════════════════════════════════════════════

function renderTrackers() {
  const all   = [...state.currentTips, ...state.customActions];
  const done  = all.filter(t => state.checkedIds.has(t.id)).length;
  const total = all.length;
  const pct   = total > 0 ? Math.round(done / total * 100) : 0;

  $id('habits-done').textContent = done;
  $id('habits-total').textContent = total;
  $id('habit-fill').style.width  = `${pct}%`;
  $id('habit-pct').textContent   = `${pct}%`;

  const label = pct === 100 ? '🎉 All actions done — Eco Hero!' :
                pct >= 50   ? '🌿 Climate Advocate — Actively mitigating carbon.' :
                pct > 0     ? '🌱 Getting started — keep going!' :
                              '⏳ No actions checked yet.';
  $id('habit-label').textContent = label;

  const dailyKg = getDailyKg();
  $id('habit-summary').textContent = total
    ? `Your active offset commitments prevent ${fmt(dailyKg,1)} Kg of carbon daily, or ${fmt(dailyKg*365/1000,3)} Tons of greenhouse gases annually.`
    : 'Check off eco-actions below to see your real-time CO₂ reductions.';

  // Reduction tracker
  if (state.lastAnalysis) {
    const co2 = state.lastAnalysis.estimated_co2;
    const annualT = (co2 * 365) / 1000;
    $id('reduction-score').textContent = fmt(annualT, 1) + 'T';
    const pctOfUs = Math.min(annualT / US_AVG * 100, 100);
    $id('reduction-marker').style.left = `${pctOfUs}%`;
    const status = annualT > 10 ? 'Status: Above Average Emissions — Need immediate offsets.'
                 : annualT > 5  ? 'Status: Moderate Emissions — Room to improve.'
                 :                'Status: ✅ Below average — Great work!';
    $id('reduction-status').textContent = status;
    $id('reduction-status').style.color  = annualT > 10 ? '#ef5350' : annualT > 5 ? '#ffab40' : '#00e676';
  }
}

// ═══════════════════════════════════════════════════════════════
// 9. ACTION TRACKER HUB
// ═══════════════════════════════════════════════════════════════

const CAT_LABELS = { Transport:'Transport', Energy:'Energy', Food:'Food', Shopping:'Shopping', Other:'Other',
                     food:'Food', transport:'Transport', energy:'Energy', other:'Other' };

function loadTips(tips, cats, co2) {
  state.currentTips = tips.map((t, i) => ({
    ...t,
    cat: Object.entries(cats || {}).sort(([,a],[,b])=>b-a)[i % 4]?.[0] || 'other',
  }));
  renderActionsList();
  renderTopStats();
  renderTrackers();
}

function renderActionsList() {
  const all = [...state.currentTips, ...state.customActions];
  const noEl = $id('no-actions');
  const listEl = $id('actions-list');

  if (all.length === 0) {
    noEl.style.display = '';
    listEl.innerHTML = '';
    return;
  }
  noEl.style.display = 'none';

  listEl.innerHTML = all.map(t => {
    const checked = state.checkedIds.has(t.id);
    const catLabel = CAT_LABELS[t.cat] || t.cat || 'Other';
    const catClr   = Object.values(CAT_CLR).find(c=>c.label.toLowerCase()===catLabel.toLowerCase())?.color || '#64748b';
    return `
      <div class="action-row${checked?' checked':''}" role="listitem" id="row-${t.id}" onclick="toggleAction('${t.id}')">
        <input type="checkbox" class="action-check" id="chk-${t.id}"
               data-id="${t.id}" ${checked?'checked':''} aria-label="${t.title}"
               onchange="toggleAction('${t.id}',event)" onclick="event.stopPropagation()"/>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold leading-snug ${checked?'line-through':''}"
               style="color:${checked?'var(--green2)':'var(--text)'}">${t.title}</div>
          <div class="sec-label mt-0.5" style="color:${catClr}">CATEGORY: ${catLabel.toUpperCase()}</div>
        </div>
        <div class="text-sm font-bold whitespace-nowrap tabular-nums" style="color:var(--green);font-family:'JetBrains Mono',monospace">
          −${fmt(t.co2_saving,1)} Kg CO₂e
        </div>
      </div>`;
  }).join('');
}

function toggleAction(id, e) {
  if (e) e.preventDefault();
  const cb = $id(`chk-${id}`);
  const row = $id(`row-${id}`);

  if (state.checkedIds.has(id)) {
    state.checkedIds.delete(id);
    if (cb) cb.checked = false;
    row?.classList.remove('checked');
  } else {
    state.checkedIds.add(id);
    if (cb) cb.checked = true;
    row?.classList.add('checked');
    toast('✅ Action committed! Your savings updated.', 'success', 2000);
  }

  saveLS(LS_ACTIONS, [...state.checkedIds]);
  renderTopStats();
  renderTrackers();
  renderBadges();
}

window.toggleAction = toggleAction;

function addCustomAction() {
  const desc = $id('custom-action').value.trim();
  const cat  = $id('custom-cat').value;
  const kg   = parseFloat($id('custom-kg').value);

  if (!desc) { toast('Please enter a commitment description.', 'error'); return; }
  if (isNaN(kg) || kg <= 0) { toast('Please enter a valid CO₂ saving value.', 'error'); return; }

  const action = {
    id:         `custom-${Date.now()}`,
    title:      desc,
    description: `Custom commitment: ${desc}`,
    co2_saving: kg,
    cat:        cat.toLowerCase(),
  };

  state.customActions.push(action);
  $id('custom-action').value = '';
  $id('custom-kg').value = '1';
  renderActionsList();
  toast(`✅ "${desc}" added to your commitments!`, 'success');
}
window.addCustomAction = addCustomAction;

// ═══════════════════════════════════════════════════════════════
// 10. BADGE MILESTONES
// ═══════════════════════════════════════════════════════════════

function getBadgeState() {
  const dailyKg = getDailyKg();
  return {
    totalLogs:      state.totalLogs,
    checkedActions: [...state.checkedIds].length,
    streak:         state.streak,
    annualSaved:    (dailyKg * 365) / 1000,
    treePower:      Math.round((dailyKg * 365) / TREE_ABSORB),
  };
}

function renderBadges() {
  const bs       = getBadgeState();
  const unlocked = BADGES.filter(b => b.cond(bs));
  const count    = unlocked.length;

  $id('badges-count').textContent = `${count} OF ${BADGES.length} UNLOCKED`;
  $id('badge-pct').textContent    = `${Math.round(count/BADGES.length*100)}% Completed`;
  $id('badge-fill').style.width   = `${count/BADGES.length*100}%`;

  $id('badge-grid').innerHTML = BADGES.map(b => {
    const isUnlocked = b.cond(bs);
    return `
      <div class="badge-card${isUnlocked?'':' locked'}" aria-label="${b.title} badge: ${isUnlocked?'Unlocked':'Locked'}">
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2.5">
            <div class="badge-icon" style="background:${b.bg};border:1.5px solid ${isUnlocked?b.color:'#243328'}">
              <span>${b.icon}</span>
            </div>
            <div>
              <div class="sec-title" style="font-size:.6rem;color:${isUnlocked?b.color:'var(--text3)'}">${b.title}</div>
              <div class="sec-label" style="font-size:.54rem">${b.sub}</div>
            </div>
          </div>
          ${isUnlocked
            ? `<div class="badge-check" aria-label="Unlocked" title="Unlocked"><svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>`
            : `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" stroke-width="1.5" aria-label="Locked"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>`
          }
        </div>

        <p class="text-xs leading-relaxed mb-3" style="color:${isUnlocked?'var(--text2)':'var(--text3)'};font-size:.73rem">${b.req}</p>

        <div class="prog-track" style="height:2px;margin-bottom:8px">
          <div class="prog-fill" style="height:2px;width:${isUnlocked?100:0}%;background:${b.color}"></div>
        </div>

        <div class="sec-title" style="font-size:.58rem;color:${isUnlocked?b.color:'var(--text3)'}">
          ${isUnlocked ? 'UNLOCKED BADGE ✓' : 'LOCKED BADGE 🔒'}
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// 11. WEEKLY TREND CHART
// ═══════════════════════════════════════════════════════════════

let chartType = 'area'; // 'area' | 'line'

function setChartType(type) {
  chartType = type;
  $id('btn-area').classList.toggle('active', type==='area');
  $id('btn-line').classList.toggle('active', type==='line');
  $id('btn-area').setAttribute('aria-pressed', type==='area');
  $id('btn-line').setAttribute('aria-pressed', type==='line');
  renderTrendChart();
}
window.setChartType = setChartType;

function renderTrendChart() {
  const data   = state.weeklyData;
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Calculate baseline as average of non-zero or global avg kg/day (11kg)
  const baselineKg = 11; // global daily avg in kg
  const baseline   = Array(7).fill(baselineKg);

  // Compute weekly mini stats
  const actualNonZero = data.filter(v=>v>0);
  const wkActual   = actualNonZero.reduce((a,b)=>a+b,0);
  const wkBaseline = baselineKg * (actualNonZero.length || 7);
  const wkDeficit  = wkActual - wkBaseline;
  const wkRate     = wkBaseline > 0 ? Math.round(((wkBaseline-wkActual)/wkBaseline)*100) : 0;

  $id('wk-baseline').textContent = `${fmt(wkBaseline,1)} Kg CO₂e`;
  $id('wk-actual').textContent   = `${fmt(wkActual,1)} Kg CO₂e`;
  $id('wk-deficit').textContent  = wkDeficit < 0 ? `${fmt(Math.abs(wkDeficit),1)} Kg Saved` : `+${fmt(wkDeficit,1)} Kg Over`;
  $id('wk-deficit').style.color  = wkDeficit < 0 ? '#00e676' : '#ef5350';
  $id('wk-rate').textContent     = wkRate >= 0 ? `${wkRate}% Off` : `+${Math.abs(wkRate)}% Over`;
  $id('wk-rate').style.color     = wkRate >= 0 ? '#ffab40' : '#ef5350';

  const ctx = $id('trend-chart').getContext('2d');

  // Gradients
  const gradGreen = ctx.createLinearGradient(0, 0, 0, 220);
  gradGreen.addColorStop(0,   'rgba(0,230,118,.35)');
  gradGreen.addColorStop(0.6, 'rgba(0,230,118,.08)');
  gradGreen.addColorStop(1,   'rgba(0,230,118,0)');

  const gradRed = ctx.createLinearGradient(0, 0, 0, 220);
  gradRed.addColorStop(0,   'rgba(239,83,80,.3)');
  gradRed.addColorStop(0.6, 'rgba(239,83,80,.06)');
  gradRed.addColorStop(1,   'rgba(239,83,80,0)');

  if (state.barChart) { state.barChart.destroy(); state.barChart = null; }

  state.barChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label:           'Actual (Kg CO₂e)',
          data:            [...data],
          borderColor:     '#00e676',
          backgroundColor: chartType === 'area' ? gradGreen : 'transparent',
          fill:            chartType === 'area',
          tension:         0.45,
          borderWidth:     2,
          pointRadius:     4,
          pointBackgroundColor: '#00e676',
          pointBorderColor: '#080d09',
          pointBorderWidth: 2,
        },
        {
          label:           'Baseline (Kg CO₂e)',
          data:            baseline,
          borderColor:     '#ef5350',
          backgroundColor: chartType === 'area' ? gradRed : 'transparent',
          fill:            chartType === 'area',
          tension:         0.45,
          borderWidth:     1.5,
          borderDash:      [5,5],
          pointRadius:     0,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: {
          display: true, position:'bottom',
          labels: { color:'#5a7a5e', font:{ family:'JetBrains Mono', size:10 }, padding:16, boxWidth:12 },
        },
        tooltip: {
          backgroundColor: '#0d1710',
          borderColor:     '#1e2e20',
          borderWidth:     1,
          titleColor:      '#d4ebd6',
          bodyColor:       '#5a7a5e',
          padding:         10,
          callbacks: {
            label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}`,
          },
        },
      },
      scales: {
        x: {
          grid:   { color:'rgba(30,46,32,.5)', drawBorder:false },
          ticks:  { color:'#3a5040', font:{ family:'JetBrains Mono', size:10 } },
          border: { display:false },
        },
        y: {
          grid:        { color:'rgba(30,46,32,.5)', drawBorder:false },
          beginAtZero: true,
          border:      { display:false },
          ticks:       { color:'#3a5040', font:{ family:'JetBrains Mono', size:10 }, callback: v=>`${v}k` },
        },
      },
      animation: { duration:700, easing:'easeOutQuart' },
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// 12. SEMI-CIRCLE ANNUAL FOOTPRINT CHART
// ═══════════════════════════════════════════════════════════════

function renderFootprintChart(cats, totalKg) {
  const totalT = (totalKg * 365) / 1000; // annual tons estimate
  const entries = Object.entries(cats).filter(([,v])=>v>0).map(([k,v])=>({
    label: CAT_CLR[k]?.label || k,
    color: CAT_CLR[k]?.color || '#64748b',
    tons:  (v * 365) / 1000,
    pct:   Math.round(v/totalKg*100),
  }));

  if (state.footChart) { state.footChart.destroy(); state.footChart = null; }

  const ctx = $id('footprint-chart').getContext('2d');

  state.footChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(e=>e.label),
      datasets: [{
        data:             entries.map(e=>e.tons),
        backgroundColor:  entries.map(e=>e.color),
        hoverOffset:      8,
        borderColor:      '#0e1811',
        borderWidth:      3,
      }],
    },
    options: {
      responsive: false, cutout:'65%',
      rotation: -90, circumference: 180,
      plugins: {
        legend:  { display:false },
        tooltip: {
          backgroundColor:'#0d1710', borderColor:'#1e2e20', borderWidth:1,
          titleColor:'#d4ebd6', bodyColor:'#5a7a5e', padding:8,
          callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(2)} Tons/Yr` },
        },
      },
      animation: { duration:800, easing:'easeOutQuart' },
    },
  });

  // Legend
  $id('footprint-legend').innerHTML = entries.map(e => `
    <div class="flex items-center justify-between py-1">
      <div class="flex items-center gap-2">
        <span style="width:10px;height:10px;border-radius:2px;background:${e.color};display:inline-block;flex-shrink:0"></span>
        <span class="text-xs" style="color:var(--text2)">${e.label}</span>
      </div>
      <div class="text-right">
        <span class="text-xs font-bold tabular-nums" style="color:var(--text);font-family:'JetBrains Mono',monospace">${fmt(e.tons,2)} Tons</span>
        <span class="text-xs ml-2" style="color:var(--muted)">(${e.pct}%)</span>
      </div>
    </div>
  `).join('') + `
    <div class="flex items-center justify-between pt-2 mt-1" style="border-top:1px solid var(--border)">
      <span class="sec-label">ESTIMATED ANNUAL TOTAL</span>
      <span class="text-sm font-bold" style="color:var(--green);font-family:'JetBrains Mono',monospace">${fmt(totalT,2)} Tons</span>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// 13. INTERACTIVE ASSESSMENT SLIDERS
// ═══════════════════════════════════════════════════════════════

function buildSliders() {
  const container = $id('assessment-sliders');
  ASSESS_DEFAULT.forEach((a, i) => {
    const val = state.assessVals[i] ?? a.val;
    container.innerHTML += `
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <div>
            <span class="text-sm font-semibold text-white">${a.label}</span>
            <span class="sec-label ml-2" style="font-size:.6rem">${a.sub}</span>
          </div>
          <div class="text-sm font-bold tabular-nums" style="color:${a.color};font-family:'JetBrains Mono',monospace">
            <span id="sv-${a.id}">${fmt(val,1)}</span> <span style="color:var(--muted);font-size:.7rem">${a.unit}</span>
          </div>
        </div>
        <div class="relative">
          <input type="range" id="${a.id}" class="w-full" min="${a.min}" max="${a.max}" step="${a.step}" value="${val}"
                 style="accent-color:${a.color};height:6px;cursor:pointer"
                 oninput="onSlider('${a.id}',${i},this.value,'${a.color}')"
                 aria-label="${a.label} slider" aria-valuenow="${val}" aria-valuemin="${a.min}" aria-valuemax="${a.max}"/>
        </div>
      </div>`;
  });
  updateAssessTotal();
}

function onSlider(id, i, val, color) {
  $id(`sv-${id}`).textContent = fmt(val, 1);
  state.assessVals[i] = parseFloat(val);
  saveLS(LS_ASSESS, state.assessVals);
  updateAssessTotal();
}
window.onSlider = onSlider;

function updateAssessTotal() {
  const total = state.assessVals.reduce((a,b)=>a+b,0);
  // Update reduction score if no live data
  if (!state.lastAnalysis) {
    $id('reduction-score').textContent = fmt(total,1)+'T';
    const pctOfUs = Math.min(total/US_AVG*100,100);
    $id('reduction-marker').style.left = `${pctOfUs}%`;
  }
}

function resetAssessment() {
  ASSESS_DEFAULT.forEach((a,i) => {
    const el = $id(a.id);
    if (el) { el.value = a.val; $id(`sv-${a.id}`).textContent = fmt(a.val,1); }
    state.assessVals[i] = a.val;
  });
  saveLS(LS_ASSESS, state.assessVals);
  updateAssessTotal();
  toast('Settings reset to defaults.', 'info');
}
window.resetAssessment = resetAssessment;

// ═══════════════════════════════════════════════════════════════
// 14. VOICE ASSISTANT (Web Speech API)
// ═══════════════════════════════════════════════════════════════

const synth = window.speechSynthesis;

function toggleVoice() {
  state.speechActive = !state.speechActive;
  const btn = $id('mic-btn');
  btn.classList.toggle('active', state.speechActive);
  btn.setAttribute('aria-pressed', state.speechActive);
  if (state.speechActive) {
    $id('voice-status').textContent = 'Listening for your command…';
    voiceRead('intro');
  } else {
    synth?.cancel();
    $id('voice-status').textContent = 'Ready for your command…';
  }
}
window.toggleVoice = toggleVoice;

function voiceRead(type) {
  const co2   = state.lastAnalysis?.estimated_co2 ?? null;
  const saved = fmt(getDailyKg(), 1);
  const texts = {
    intro:   `Hello! I am Carbon Trace Assistant. You can ask me to read your scores, suggest saving tips, or provide AI insights.`,
    score:   co2 ? `Your today's carbon score is ${fmt(co2,1)} kilograms of CO₂ equivalent. Your daily savings from committed actions is ${saved} kilograms.`
                 : `No score recorded yet. Please log your activities first.`,
    tip:     state.currentTips[0]
                 ? `Here is a tip: ${state.currentTips[0].title}. ${state.currentTips[0].description}`
                 : `No tips available yet. Log an activity to get personalised eco-actions.`,
    insight: state.lastAnalysis?.habit_analysis
                 ? state.lastAnalysis.habit_analysis
                 : `No insights available yet. Analyse your activities with Gemini AI first.`,
  };
  const text = texts[type] || texts.intro;
  $id('voice-text').textContent = `"${text}"`;
  $id('voice-status').textContent = 'Speaking…';

  if (synth) {
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.92; utt.pitch = 1; utt.volume = 0.95;
    utt.onend = () => { $id('voice-status').textContent = 'Done. Ready for next command…'; };
    synth.speak(utt);
  }
}
window.voiceRead = voiceRead;

// ═══════════════════════════════════════════════════════════════
// 15. GEMINI AI ADVISOR
// ═══════════════════════════════════════════════════════════════

function renderInsightsReady(habitText) {
  $id('insights-box').innerHTML = `
    <p class="text-xs leading-relaxed" style="color:var(--text2)">${habitText}</p>`;
}

async function getInsights() {
  if (state.lastAnalysis) {
    renderInsightsReady(state.lastAnalysis.habit_analysis);
    toast('✨ AI insights loaded from last analysis.', 'info', 2000);
    return;
  }
  $id('insights-label').textContent = '⏳ LOADING…';
  const text = $id('log-input').value.trim();
  if (!text) {
    $id('insights-box').innerHTML = `<p class="text-xs" style="color:var(--red)">Please log an activity first to get AI insights.</p>`;
    $id('insights-label').textContent = '🔄 GET INSIGHTS';
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/logs/analyse`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ activity_text: text }),
    });
    if (!res.ok) throw new Error('Backend error');
    const data = await res.json();
    state.lastAnalysis = data;
    renderInsightsReady(data.habit_analysis);
    toast('✨ Gemini AI insights generated!', 'success');
  } catch(_) {
    $id('insights-box').innerHTML = `<p class="text-xs" style="color:var(--red)">Could not fetch insights. Is the backend running?</p>`;
  } finally {
    $id('insights-label').textContent = '🔄 GET INSIGHTS';
  }
}
window.getInsights = getInsights;

// ═══════════════════════════════════════════════════════════════
// 16. EXAMPLE CHIPS
// ═══════════════════════════════════════════════════════════════

function initChips() {
  $$('[data-ex]').forEach(btn => {
    btn.addEventListener('click', () => {
      const txt = EXAMPLES[btn.dataset.ex];
      if (!txt) return;
      $id('log-input').value = txt;
      $id('log-chars').textContent = `${txt.length}/500`;
      $id('log-input').focus();
    });
  });
  $id('log-input').addEventListener('input', () => {
    $id('log-chars').textContent = `${$id('log-input').value.length}/500`;
    if ($id('log-input').value.length >= 5) setErr('');
  });
}

// ═══════════════════════════════════════════════════════════════
// 17. RESTORE SAVED ACTIONS (on load)
// ═══════════════════════════════════════════════════════════════

function restoreOnLoad() {
  // If user has previous streak
  if (state.streak >= 2) {
    $id('streak-badge').classList.remove('hidden');
    $id('streak-badge').style.display = 'inline-flex';
    $id('streak-val').textContent = state.streak;
    $id('stat-streak').textContent = state.streak;
    $id('stat-streak-sub').textContent = `${state.streak} active habits`;
  }
}

// ═══════════════════════════════════════════════════════════════
// 18. INIT
// ═══════════════════════════════════════════════════════════════

function init() {
  $id('log-form').addEventListener('submit', handleSubmit);
  initChips();
  buildSliders();
  restoreOnLoad();
  renderBadges();
  renderTrendChart();
  renderTrackers();
  renderTopStats();

  // Pre-render weekly chart if data exists
  if (state.weeklyData.some(v=>v>0)) {
    renderTrendChart();
  }

  console.info('[Footprint] 🌱 EcoTrack UI loaded. Backend:', API_BASE);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
