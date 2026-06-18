/**
 * @fileoverview Footprint — AI Carbon Tracker frontend application logic.
 *
 * Responsibilities:
 *  1. Natural-language activity form: validation, submission, loading states.
 *  2. Real-time dashboard rendering: CO₂ score ring, category bars, habit analysis.
 *  3. Actionable gamification: interactive tip checklist, savings banner, celebration.
 *  4. Data visualisation: Chart.js bar chart (weekly trend) + doughnut (categories).
 *  5. Persistence: localStorage for weekly history and streak tracking.
 *  6. Accessibility: ARIA live regions, keyboard navigation, focus management.
 *
 * @module FootprintApp
 */

'use strict';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** @const {string} Base URL for the FastAPI backend API. */
const API_BASE = 'http://127.0.0.1:8000';

/** @const {number} Global average daily CO₂ (kg) for gauge calibration. */
const GLOBAL_AVG_CO2 = 11;

/** @const {string} localStorage key for 7-day rolling CO₂ history. */
const LS_WEEKLY = 'fp_weekly_v2';

/** @const {string} localStorage key for streak count. */
const LS_STREAK = 'fp_streak_v2';

/** @const {string} localStorage key for last log date. */
const LS_LAST_DATE = 'fp_last_date_v2';

// ---------------------------------------------------------------------------
// Example prompt texts keyed by data-example attribute
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const EXAMPLES = {
  'car-burger':
    'I drove 15km to work and back in a petrol car. Had a beef burger for lunch and chicken pasta for dinner.',
  'cycle-vegan':
    'Cycled 8km to the office. Had a vegan salad for lunch and a plant-based curry for dinner. Watched 2 hours of Netflix.',
  'flight':
    'Took a long-haul flight from London to New York in economy class (7 hour flight). Had a chicken meal on the plane.',
  'wfh-ac':
    'Worked from home all day with air conditioning on for 8 hours. Had a vegetarian pasta for lunch and a beef steak for dinner.',
};

// ---------------------------------------------------------------------------
// Category display configuration
// ---------------------------------------------------------------------------

/** @type {Record<string, {label: string, color: string, icon: string}>} */
const CATEGORY_CFG = {
  food:      { label: 'Food & Diet',  color: '#f97316', icon: '🍔' },
  transport: { label: 'Transport',    color: '#0ea5e9', icon: '🚗' },
  energy:    { label: 'Home Energy',  color: '#a855f7', icon: '⚡' },
  other:     { label: 'Other',        color: '#64748b', icon: '🌍' },
};

// ============================================================================
// DOM REFERENCES (cached once)
// ============================================================================

/** @param {string} sel @returns {Element|null} */
const $  = (sel) => document.querySelector(sel);
/** @param {string} sel @returns {NodeList} */
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  form:             /** @type {HTMLFormElement}        */ ($('#activity-form')),
  textarea:         /** @type {HTMLTextAreaElement}    */ ($('#activity-input')),
  charCounter:      /** @type {HTMLElement}            */ ($('#char-counter')),
  inputError:       /** @type {HTMLElement}            */ ($('#input-error')),
  submitBtn:        /** @type {HTMLButtonElement}      */ ($('#submit-btn')),
  submitLabel:      /** @type {HTMLElement}            */ ($('#submit-label')),
  submitIcon:       /** @type {SVGElement}             */ ($('#submit-icon')),
  loadingStatus:    /** @type {HTMLElement}            */ ($('#loading-status')),
  dashboard:        /** @type {HTMLElement}            */ ($('#dashboard')),
  scoreRing:        /** @type {HTMLElement}            */ ($('#score-ring')),
  co2Value:         /** @type {HTMLElement}            */ ($('#co2-value')),
  co2Label:         /** @type {HTMLElement}            */ ($('#co2-label')),
  co2GaugeFill:     /** @type {HTMLElement}            */ ($('#co2-gauge-fill')),
  co2GaugeWrapper:  /** @type {HTMLElement}            */ ($('#co2-gauge-wrapper')),
  weeklyAvg:        /** @type {HTMLElement}            */ ($('#weekly-avg')),
  potentialSaved:   /** @type {HTMLElement}            */ ($('#potential-saved')),
  habitText:        /** @type {HTMLElement}            */ ($('#habit-text')),
  categoryBars:     /** @type {HTMLElement}            */ ($('#category-bars')),
  tipsList:         /** @type {HTMLElement}            */ ($('#tips-list')),
  tipsProgressText: /** @type {HTMLElement}            */ ($('#tips-progress-text')),
  tipsProgressBar:  /** @type {HTMLElement}            */ ($('#tips-progress-bar')),
  savingsBanner:    /** @type {HTMLElement}            */ ($('#savings-banner')),
  totalSavings:     /** @type {HTMLElement}            */ ($('#total-savings')),
  treesEquivalent:  /** @type {HTMLElement}            */ ($('#trees-equivalent')),
  allDoneBanner:    /** @type {HTMLElement}            */ ($('#all-done-banner')),
  weeklyChart:      /** @type {HTMLCanvasElement}      */ ($('#weekly-chart')),
  donutChart:       /** @type {HTMLCanvasElement}      */ ($('#donut-chart')),
  toast:            /** @type {HTMLElement}            */ ($('#toast')),
  streakBadge:      /** @type {HTMLElement}            */ ($('#streak-badge')),
  streakCount:      /** @type {HTMLElement}            */ ($('#streak-count')),
  chips:            $$('[data-example]'),
};

// ============================================================================
// STATE
// ============================================================================

/**
 * @typedef {Object} Tip
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} co2_saving
 */

/**
 * @typedef {Object} AppState
 * @property {number[]}    weeklyData    - 7-element rolling daily CO₂ history.
 * @property {Set<string>} completedTips - IDs of currently completed tips.
 * @property {Tip[]}       currentTips   - Tips from the latest API response.
 * @property {Chart|null}  barChart      - Chart.js bar chart instance.
 * @property {Chart|null}  donutChart    - Chart.js doughnut chart instance.
 * @property {boolean}     isLoading     - Whether an API request is in-flight.
 */

/** @type {AppState} */
const state = {
  weeklyData:    _loadWeeklyData(),
  completedTips: new Set(),
  currentTips:   [],
  barChart:      null,
  donutChart:    null,
  isLoading:     false,
};

// ============================================================================
// PERSISTENCE HELPERS
// ============================================================================

/**
 * Load the last 7 days of CO₂ data from localStorage.
 * Returns a 7-element zeros array if nothing is stored or data is invalid.
 *
 * @returns {number[]}
 */
function _loadWeeklyData() {
  try {
    const raw = localStorage.getItem(LS_WEEKLY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === 7 && arr.every(v => typeof v === 'number')) {
        return arr;
      }
    }
  } catch (_) { /* ignore parse errors */ }
  return Array(7).fill(0);
}

/** Persist current weekly data to localStorage. */
function _saveWeeklyData() {
  localStorage.setItem(LS_WEEKLY, JSON.stringify(state.weeklyData));
}

/**
 * Update the daily streak counter and refresh the header badge.
 * - Increments if the last log was yesterday.
 * - Resets to 1 if the gap is > 1 day.
 * - Unchanged if the user already logged today.
 */
function _updateStreak() {
  const today = new Date().toDateString();
  const lastDate = localStorage.getItem(LS_LAST_DATE) || '';
  let streak = parseInt(localStorage.getItem(LS_STREAK) || '0', 10);

  if (!lastDate) {
    streak = 1;
  } else if (lastDate === today) {
    // Already logged today — no change
  } else {
    const diffMs = new Date(today).getTime() - new Date(lastDate).getTime();
    const diffDays = Math.round(diffMs / 86_400_000);
    streak = diffDays === 1 ? streak + 1 : 1;
  }

  localStorage.setItem(LS_STREAK, String(streak));
  localStorage.setItem(LS_LAST_DATE, today);

  dom.streakCount.textContent = streak;
  const show = streak >= 2;
  dom.streakBadge.classList.toggle('hidden',   !show);
  dom.streakBadge.classList.toggle('flex',      show);
  dom.streakBadge.classList.toggle('inline-flex', show);
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

/** @type {ReturnType<typeof setTimeout>|null} */
let _toastTimer = null;

/**
 * Show an accessible, auto-dismissing toast notification.
 *
 * @param {string} message                               - Text to display.
 * @param {'success'|'error'|'info'} [type='success']   - Visual style.
 * @param {number} [duration=3200]                       - Auto-dismiss delay (ms).
 */
function showToast(message, type = 'success', duration = 3200) {
  const styles = {
    success: 'background:rgba(34,197,94,0.15); border:1.5px solid rgba(34,197,94,0.3); color:#4ade80',
    error:   'background:rgba(239,68,68,0.15); border:1.5px solid rgba(239,68,68,0.3); color:#f87171',
    info:    'background:rgba(96,165,250,0.15); border:1.5px solid rgba(96,165,250,0.3); color:#93c5fd',
  };
  dom.toast.setAttribute('style',
    `position:fixed;bottom:28px;right:28px;z-index:9999;padding:14px 22px;border-radius:14px;font-size:.88rem;font-weight:600;max-width:360px;${styles[type]}`
  );
  dom.toast.textContent = message;
  dom.toast.classList.add('visible');

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => dom.toast.classList.remove('visible'), duration);
}

// ============================================================================
// LOADING STATE
// ============================================================================

/**
 * Toggle the submit button between idle and loading states.
 *
 * @param {boolean} loading
 */
function setLoadingState(loading) {
  state.isLoading = loading;
  dom.submitBtn.classList.toggle('loading', loading);
  dom.submitBtn.setAttribute('aria-busy', String(loading));
  dom.loadingStatus.classList.toggle('hidden', !loading);
  dom.loadingStatus.style.display = loading ? 'flex' : '';
  dom.submitLabel.textContent = loading ? 'Analysing…' : 'Analyse My Footprint';
}

// ============================================================================
// INPUT VALIDATION UI
// ============================================================================

/**
 * Show or clear a validation error on the textarea.
 *
 * @param {string} message - Error text, or '' to clear.
 */
function setInputError(message) {
  dom.inputError.textContent = message;
  dom.inputError.classList.toggle('hidden', !message);
  dom.textarea.setAttribute('aria-invalid', message ? 'true' : 'false');
}

// ============================================================================
// SCORE RING
// ============================================================================

/**
 * Render the conic-gradient CO₂ score ring with animated number counter.
 *
 * @param {number} co2 - Total CO₂ in kg CO₂e.
 */
function renderScoreRing(co2) {
  // Clamp percentage to a 2× global average ceiling
  const pct = Math.min((co2 / (GLOBAL_AVG_CO2 * 2)) * 100, 100);

  // Pick colour + glow based on severity
  let ringColor, ringGlow, label, labelColor;
  if (co2 < 4) {
    ringColor = '#22c55e'; ringGlow = 'rgba(34,197,94,0.35)';
    label = '🌿 Low — great job!'; labelColor = '#4ade80';
  } else if (co2 < 8) {
    ringColor = '#f59e0b'; ringGlow = 'rgba(245,158,11,0.35)';
    label = '⚡ Moderate — room to improve'; labelColor = '#fbbf24';
  } else if (co2 < 15) {
    ringColor = '#f97316'; ringGlow = 'rgba(249,115,22,0.35)';
    label = '🔥 High — let\'s take action'; labelColor = '#fb923c';
  } else {
    ringColor = '#ef4444'; ringGlow = 'rgba(239,68,68,0.35)';
    label = '🚨 Very high — urgent action!'; labelColor = '#f87171';
  }

  dom.scoreRing.style.setProperty('--pct', `${pct.toFixed(1)}%`);
  dom.scoreRing.style.setProperty('--ring-color', ringColor);
  dom.scoreRing.style.setProperty('--ring-glow', ringGlow);

  // Animated number count-up
  const startVal = parseFloat(dom.co2Value.textContent) || 0;
  const endVal   = co2;
  const dur      = 900;
  const t0       = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - t0) / dur, 1);
    const eased    = 1 - (1 - progress) ** 3; // ease-out cubic
    dom.co2Value.textContent = (startVal + (endVal - startVal) * eased).toFixed(1);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Gauge fill
  const gaugeW = Math.min((co2 / GLOBAL_AVG_CO2) * 100, 100);
  dom.co2GaugeFill.style.width     = `${gaugeW}%`;
  dom.co2GaugeFill.style.background = ringColor;
  dom.co2GaugeWrapper.setAttribute('aria-valuenow', String(Math.round(gaugeW)));

  // Label
  dom.co2Label.textContent  = label;
  dom.co2Label.style.color  = labelColor;
}

// ============================================================================
// MINI STATS
// ============================================================================

/**
 * Update the "Weekly Avg" and "Potential Saved" mini stat cards.
 *
 * @param {number[]} weeklyData - 7-element array of daily CO₂ values.
 * @param {Tip[]}    tips       - Current actionable tips.
 */
function renderMiniStats(weeklyData, tips) {
  const nonZero = weeklyData.filter(v => v > 0);
  const avg     = nonZero.length > 0
    ? (nonZero.reduce((a, b) => a + b, 0) / nonZero.length).toFixed(1)
    : '—';
  dom.weeklyAvg.textContent = avg !== '—' ? avg : '—';

  const saved = tips.reduce((acc, t) => acc + (t.co2_saving || 0), 0);
  dom.potentialSaved.textContent = saved.toFixed(1);
}

// ============================================================================
// CATEGORY BARS
// ============================================================================

/**
 * Render animated horizontal category emission bars.
 *
 * @param {{food:number, transport:number, energy:number, other:number}} cats
 * @param {number} total - Total CO₂ for percentage calculation.
 */
function renderCategoryBars(cats, total) {
  const entries = Object.entries(cats)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    dom.categoryBars.innerHTML = '<p class="text-sm text-slate-500 italic">No data yet.</p>';
    return;
  }

  dom.categoryBars.innerHTML = entries.map(([key, value]) => {
    const cfg = CATEGORY_CFG[key] || { label: key, color: '#64748b', icon: '🌍' };
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return `
      <div class="space-y-1.5" role="group" aria-label="${cfg.label} emission bar">
        <div class="flex justify-between items-center">
          <span class="text-sm flex items-center gap-1.5" style="color:#94a3b8">
            <span aria-hidden="true">${cfg.icon}</span>${cfg.label}
          </span>
          <span class="text-sm font-semibold text-white tabular-nums">${value.toFixed(2)} kg</span>
        </div>
        <div class="prog-track" role="progressbar"
             aria-label="${cfg.label}: ${pct}% of total"
             aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="cat-bar" style="width:0%; background:${cfg.color}"
               data-target="${pct}"></div>
        </div>
      </div>`;
  }).join('');

  // Animate bars after DOM insertion (RAF ensures the 0% starting width is painted first)
  requestAnimationFrame(() => {
    dom.categoryBars.querySelectorAll('.cat-bar').forEach(bar => {
      const target = bar.dataset.target;
      requestAnimationFrame(() => { bar.style.width = `${target}%`; });
    });
  });
}

// ============================================================================
// DOUGHNUT CHART
// ============================================================================

/**
 * Initialise or update the category doughnut chart.
 *
 * @param {{food:number, transport:number, energy:number, other:number}} cats
 */
function renderDonutChart(cats) {
  const entries   = Object.entries(cats).filter(([, v]) => v > 0);
  const labels    = entries.map(([k]) => CATEGORY_CFG[k]?.label || k);
  const data      = entries.map(([, v]) => parseFloat(v.toFixed(2)));
  const colors    = entries.map(([k]) => CATEGORY_CFG[k]?.color || '#64748b');
  const hoverColors = colors.map(c => c + 'cc');

  if (state.donutChart) {
    state.donutChart.data.labels              = labels;
    state.donutChart.data.datasets[0].data   = data;
    state.donutChart.data.datasets[0].backgroundColor = colors;
    state.donutChart.update('active');
    return;
  }

  state.donutChart = new Chart(dom.donutChart, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor:      colors,
        hoverBackgroundColor: hoverColors,
        borderColor:          'rgba(13,26,46,0.8)',
        borderWidth:          3,
        hoverOffset:          8,
      }],
    },
    options: {
      responsive:          false,
      cutout:              '70%',
      plugins: {
        legend: {
          display:  true,
          position: 'bottom',
          labels: {
            color:      '#7a8fa8',
            font:       { family: 'Inter', size: 10 },
            boxWidth:   10,
            padding:    10,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: '#0d1a2e',
          borderColor:     'rgba(255,255,255,0.08)',
          borderWidth:     1,
          titleColor:      '#e8f0fe',
          bodyColor:       '#7a8fa8',
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(2)} kg CO₂e`,
          },
        },
      },
      animation: { duration: 800, easing: 'easeOutQuart' },
    },
  });
}

// ============================================================================
// HABIT ANALYSIS
// ============================================================================

/**
 * Update the habit analysis paragraph (only if content changed).
 *
 * @param {string} text
 */
function renderHabitAnalysis(text) {
  if (dom.habitText.textContent !== text) {
    dom.habitText.textContent = text;
  }
}

// ============================================================================
// TIPS / GAMIFICATION
// ============================================================================

/**
 * Render the full actionable tips checklist and savings banner.
 *
 * @param {Tip[]} tips
 */
function renderTips(tips) {
  state.currentTips = tips;
  state.completedTips.clear();

  // Savings banner
  const totalSaving  = tips.reduce((acc, t) => acc + (t.co2_saving || 0), 0);
  const treesPerYear = 21.8; // avg kg CO₂/year absorbed per tree
  const trees        = Math.max(1, Math.round((totalSaving * 365) / treesPerYear));

  dom.totalSavings.textContent   = `${totalSaving.toFixed(1)} kg CO₂e`;
  dom.treesEquivalent.textContent = `${trees} tree${trees !== 1 ? 's' : ''}`;
  dom.savingsBanner.classList.remove('hidden');
  dom.allDoneBanner.classList.add('hidden');

  // Build tip cards
  dom.tipsList.innerHTML = tips.map((tip, i) => `
    <li role="listitem">
      <article
        class="tip-card glass-bright p-5 flex gap-4 items-start animate-slide-up"
        id="tip-card-${tip.id}"
        aria-label="Eco tip ${i + 1} of ${tips.length}: ${tip.title}"
        style="animation-delay:${0.05 * i}s"
      >
        <!-- Custom checkbox -->
        <input
          type="checkbox"
          class="tip-checkbox mt-0.5"
          id="tip-chk-${tip.id}"
          data-tip-id="${tip.id}"
          aria-label="Mark action '${tip.title}' as completed"
        />

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <label
            for="tip-chk-${tip.id}"
            class="tip-title block font-semibold text-sm mb-1.5 cursor-pointer transition-colors"
            style="color:#e8f0fe"
          >${tip.title}</label>
          <p class="text-xs leading-relaxed" style="color:#7a8fa8">${tip.description}</p>

          <!-- CO₂ saving badge -->
          <div class="flex items-center gap-1.5 mt-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#22c55e" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
            <span class="text-xs font-semibold" style="color:#4ade80">
              Saves ~${tip.co2_saving.toFixed(1)} kg CO₂e
            </span>
          </div>
        </div>

        <!-- Tip number badge -->
        <div class="tip-badge" aria-hidden="true">${i + 1}</div>
      </article>
    </li>
  `).join('');

  // Attach change listeners
  dom.tipsList.querySelectorAll('.tip-checkbox').forEach(cb => {
    cb.addEventListener('change', _handleTipToggle);
  });

  _updateTipsProgress();
}

/**
 * Handle a tip checkbox toggle.
 *
 * @param {Event} e
 */
function _handleTipToggle(e) {
  const cb    = /** @type {HTMLInputElement} */ (e.target);
  const tipId = cb.dataset.tipId;
  const card  = document.getElementById(`tip-card-${tipId}`);

  if (cb.checked) {
    state.completedTips.add(tipId);
    card?.classList.add('completed');
    showToast('✅ Action completed! Great work!', 'success', 2400);
  } else {
    state.completedTips.delete(tipId);
    card?.classList.remove('completed');
  }

  _updateTipsProgress();
}

/**
 * Update the tips progress bar / text; trigger celebration when all done.
 */
function _updateTipsProgress() {
  const total  = state.currentTips.length;
  const done   = state.completedTips.size;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;

  dom.tipsProgressText.textContent = `${done} / ${total} done`;
  dom.tipsProgressBar.style.width  = `${pct}%`;
  dom.allDoneBanner.classList.toggle('hidden', !allDone);

  if (allDone) {
    setTimeout(() => {
      dom.allDoneBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('🌍 All actions done — you\'re an eco-hero!', 'success', 5000);
    }, 200);
  }
}

// ============================================================================
// WEEKLY TREND CHART
// ============================================================================

/**
 * Initialise or update the Chart.js weekly trend bar chart.
 * Uses Chart.js's in-place update to avoid destroying and re-creating the instance.
 *
 * @param {number[]} data - 7-element array of daily CO₂ values.
 */
function renderWeeklyChart(data) {
  const labels   = ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'];
  const ctx      = dom.weeklyChart.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0,   'rgba(34,197,94,0.85)');
  gradient.addColorStop(0.7, 'rgba(34,197,94,0.3)');
  gradient.addColorStop(1,   'rgba(34,197,94,0.05)');

  if (state.barChart) {
    state.barChart.data.datasets[0].data = [...data];
    state.barChart.data.datasets[0].backgroundColor = gradient;
    state.barChart.update('active');
    return;
  }

  state.barChart = new Chart(dom.weeklyChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label:           'kg CO₂e',
        data:            [...data],
        backgroundColor: gradient,
        borderColor:     'rgba(34,197,94,0.8)',
        borderWidth:     1.5,
        borderRadius:    10,
        borderSkipped:   false,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1a2e',
          borderColor:     'rgba(255,255,255,0.1)',
          borderWidth:     1,
          titleColor:      '#e8f0fe',
          bodyColor:       '#7a8fa8',
          padding:         10,
          callbacks: {
            title: (items) => items[0].label,
            label: (ctx)  => ` ${ctx.parsed.y.toFixed(2)} kg CO₂e`,
          },
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: { color: '#4a5e74', font: { family: 'Inter', size: 11 } },
          border: { display: false },
        },
        y: {
          grid:      { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          beginAtZero: true,
          border:    { display: false },
          ticks: {
            color:    '#4a5e74',
            font:     { family: 'Inter', size: 11 },
            callback: v => `${v} kg`,
            maxTicksLimit: 6,
          },
        },
      },
      animation: { duration: 800, easing: 'easeOutQuart' },
    },
  });
}

// ============================================================================
// DASHBOARD ORCHESTRATION
// ============================================================================

/**
 * Render all dashboard components from a single API response object.
 * Uses targeted DOM updates — no full page reload.
 *
 * @param {{
 *   estimated_co2: number,
 *   categories: {food:number, transport:number, energy:number, other:number},
 *   habit_analysis: string,
 *   actionable_tips: Tip[]
 * }} data - Validated API response.
 */
function renderDashboard(data) {
  // 1. Show dashboard
  dom.dashboard.classList.remove('hidden');
  dom.dashboard.removeAttribute('aria-hidden');

  // 2. Shift weekly rolling window and append today's value
  state.weeklyData = [...state.weeklyData.slice(1), data.estimated_co2];
  _saveWeeklyData();

  // 3. Render all components
  renderScoreRing(data.estimated_co2);
  renderCategoryBars(data.categories, data.estimated_co2);
  renderDonutChart(data.categories);
  renderHabitAnalysis(data.habit_analysis);
  renderTips(data.actionable_tips);
  renderMiniStats(state.weeklyData, data.actionable_tips);
  renderWeeklyChart(state.weeklyData);

  // 4. Update streak
  _updateStreak();

  // 5. Smooth scroll to dashboard
  setTimeout(() => {
    dom.dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ============================================================================
// API CALL
// ============================================================================

/**
 * Submit an activity log to the FastAPI backend and render the full dashboard.
 *
 * @param {string} activityText - User's validated activity description.
 * @returns {Promise<void>}
 */
async function submitActivity(activityText) {
  setLoadingState(true);
  setInputError('');

  try {
    const response = await fetch(`${API_BASE}/api/logs/analyse`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify({ activity_text: activityText }),
    });

    if (!response.ok) {
      let detail = `Server error (${response.status}).`;
      try {
        const err = await response.json();
        detail = err.detail || detail;
      } catch (_) { /* ignore json parse errors on error body */ }
      throw new Error(detail);
    }

    const data = await response.json();
    renderDashboard(data);
    showToast('✨ Analysis complete! Check your dashboard.', 'success');

  } catch (err) {
    console.error('[Footprint] API error:', err);
    const msg = err.message?.includes('Failed to fetch')
      ? '⚠️ Cannot reach the backend. Is the FastAPI server running on port 8000?'
      : `❌ ${err.message || 'An unexpected error occurred.'}`;
    showToast(msg, 'error', 6000);
    setInputError(err.message || 'An unexpected error occurred.');
  } finally {
    setLoadingState(false);
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle form submission — client-side validation then API call.
 *
 * @param {SubmitEvent} e
 */
function handleFormSubmit(e) {
  e.preventDefault();
  if (state.isLoading) return;

  const text = dom.textarea.value.trim();

  if (!text || text.length < 5) {
    setInputError('Please describe at least one activity (minimum 5 characters).');
    dom.textarea.focus();
    return;
  }
  if (text.length > 500) {
    setInputError('Activity description must be 500 characters or fewer.');
    dom.textarea.focus();
    return;
  }

  setInputError('');
  submitActivity(text);
}

/**
 * Update the character counter as the user types.
 */
function handleTextareaInput() {
  const len = dom.textarea.value.length;
  dom.charCounter.textContent = `${len} / 500`;
  dom.charCounter.style.color = len > 450 ? '#f97316' : '';
  if (len >= 5) setInputError('');
}

/**
 * Populate the textarea with an example activity when a chip is clicked.
 *
 * @param {MouseEvent} e
 */
function handleChipClick(e) {
  const btn  = /** @type {HTMLButtonElement} */ (e.currentTarget);
  const key  = btn.dataset.example;
  const text = EXAMPLES[key];
  if (!text) return;

  dom.textarea.value = text;
  handleTextareaInput();
  dom.textarea.focus();
  dom.textarea.setSelectionRange(text.length, text.length);
}

// ============================================================================
// INITIALISATION
// ============================================================================

/**
 * Bootstrap the application: wire all event listeners and pre-render
 * any persisted historical data from localStorage.
 */
function init() {
  // Form submission
  dom.form.addEventListener('submit', handleFormSubmit);

  // Character counter
  dom.textarea.addEventListener('input', handleTextareaInput);

  // Example chips
  dom.chips.forEach(chip => chip.addEventListener('click', handleChipClick));

  // Keyboard: Space/Enter on submit button (redundant but explicit for a11y)
  dom.submitBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dom.form.requestSubmit();
    }
  });

  // Pre-render historical weekly chart if data exists
  renderWeeklyChart(state.weeklyData);
  if (state.weeklyData.some(v => v > 0)) {
    dom.dashboard.classList.remove('hidden');
    renderMiniStats(state.weeklyData, []);
  }

  // Restore streak badge on load
  const savedStreak = parseInt(localStorage.getItem(LS_STREAK) || '0', 10);
  if (savedStreak >= 2) {
    dom.streakCount.textContent = savedStreak;
    dom.streakBadge.classList.remove('hidden');
    dom.streakBadge.classList.add('flex');
  }

  console.info('[Footprint] 🌱 App initialised. Backend target:', API_BASE);
}

// ============================================================================
// BOOT
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
