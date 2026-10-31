const MAX_SAMPLES = 120;
const MAX_ACTIVE_TRACES = 8;
const FLOWS = new Set(['list', 'open_note', 'new_note', 'save']);
const STATES = new Set(['clean', 'dirty', 'na']);
const CACHES = new Set(['hit', 'miss', 'na']);
const CACHE_MISS_REASONS = new Set(['entry_absent', 'revision_mismatch', 'missing_from_list', 'note_too_large', 'content_budget_eviction', 'shared_content_disabled', 'cache_unavailable']);
const PHASES = new Set([
  'guard_wait_ms', 'save_guard_ms', 'debounce_wait_ms', 'queue_wait_ms', 'network_ms',
  'response_body_ms', 'cache_read_ms', 'content_assign_ms', 'frame_after_update_ms',
  'retry_wait_ms', 'input_to_ack_ms', 'server_ack_ms', 'flow_total_ms', 'render_ms',
  'click_to_content_assign_ms', 'click_to_first_frame_ms', 'background_revision_assign_ms',
  'server_pre_response_ms', 'server_auth_ms', 'server_store_init_ms', 'server_store_operation_ms'
]);
const ALLOWED_STATUS = new Set([400, 401, 403, 404, 408, 409, 413, 423, 429, 500, 502, 503, 504]);

export function diagnosticsRequested(search = '') {
  try { return new URLSearchParams(search).get('diag') === '1'; }
  catch { return false; }
}

const now = () => globalThis.performance?.now?.() ?? Date.now();

export class PerformanceDiagnostics {
  constructor({ enabled = false, frame = callback => requestAnimationFrame(callback), clock = now } = {}) {
    this.enabled = enabled === true;
    this.frame = frame;
    this.clock = clock;
    this.samples = [];
    this.active = new Set();
    this.inputTimes = new WeakMap();
    this.ackedInputs = new WeakMap();
    if (this.enabled && typeof document !== 'undefined') this.mountPanel();
  }

  begin(flow, { state = 'na', cache = 'na', startAt = null } = {}) {
    if (!this.enabled || !FLOWS.has(flow) || this.active.size >= MAX_ACTIVE_TRACES) return null;
    const trace = {
      flow, state: STATES.has(state) ? state : 'na', cache: CACHES.has(cache) ? cache : 'na',
      startedAt: Number.isFinite(startAt) ? startAt : this.clock(),
      phases: Object.create(null), requests: 0, errors: Object.create(null), cacheMissReasons: Object.create(null), finished: false, firstContentAssigned: false
    };
    this.active.add(trace);
    return trace;
  }

  phase(trace, name, durationMs) {
    if (!trace || trace.cancelled || !PHASES.has(name) || !Number.isFinite(durationMs)) return;
    trace.phases[name] = (trace.phases[name] ?? 0) + Math.max(0, durationMs);
  }

  request(trace) { if (trace) trace.requests += 1; }

  setCache(trace, cache) { if (trace && CACHES.has(cache)) trace.cache = cache; }
  cacheMissReason(trace, reason) {
    if (!trace || !CACHE_MISS_REASONS.has(reason)) return;
    trace.cacheMissReasons[reason] = (trace.cacheMissReasons[reason] ?? 0) + 1;
  }
  setState(trace, state) { if (trace && STATES.has(state)) trace.state = state; }

  error(trace, status) {
    if (!trace) return;
    const code = ALLOWED_STATUS.has(Number(status)) ? String(Number(status)) : 'network';
    trace.errors[code] = (trace.errors[code] ?? 0) + 1;
  }

  finish(trace, { error = null } = {}) {
    if (!trace || trace.finished || trace.cancelled) return;
    trace.finished = true;
    this.active.delete(trace);
    if (trace.flow !== 'open_note') this.phase(trace, 'flow_total_ms', this.clock() - trace.startedAt);
    if (error) {
      const code = ALLOWED_STATUS.has(Number(error.status)) ? String(Number(error.status)) : 'network';
      if (!trace.errors[code]) this.error(trace, error.status);
    }
    this.samples.push(trace);
    if (this.samples.length > MAX_SAMPLES) this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    this.renderSummary();
  }

  afterUpdate(trace, startedAt, firstContent = false) {
    if (!this.enabled || !trace || typeof this.frame !== 'function') return;
    this.frame(() => { const at = this.clock(); this.phase(trace, 'frame_after_update_ms', at - startedAt); if (firstContent) this.phase(trace, 'click_to_first_frame_ms', at - trace.startedAt); });
  }

  markInput(session, version) {
    if (!this.enabled) return;
    const at = this.clock();
    if (session && Number.isInteger(version)) {
      let versions = this.inputTimes.get(session); if (!versions) this.inputTimes.set(session, versions = new Map());
      versions.set(version, at);
      while (versions.size > 32) versions.delete(versions.keys().next().value);
    }
  }

  inputTime(session, version) { return this.enabled ? this.inputTimes.get(session)?.get(version) ?? null : null; }

  acknowledgeInput(trace, session, version) {
    if (!this.enabled || !trace || !session || !Number.isInteger(version)) return;
    let versions = this.ackedInputs.get(session); if (!versions) this.ackedInputs.set(session, versions = new Set());
    if (versions.has(version)) return;
    const at = this.inputTimes.get(session)?.get(version); if (!Number.isFinite(at)) return;
    versions.add(version); this.phase(trace, 'input_to_ack_ms', this.clock() - at);
  }

  firstContent(trace, assignmentAt) {
    if (!this.enabled || !trace || trace.firstContentAssigned) return;
    trace.firstContentAssigned = true;
    this.phase(trace, 'click_to_content_assign_ms', assignmentAt - trace.startedAt);

  }

  summary() {
    const grouped = new Map();
    for (const sample of this.samples) {
      const key = `${sample.flow}:${sample.state}:${sample.cache}`;
      if (!grouped.has(key)) grouped.set(key, { flow: sample.flow, editor: sample.state, cache: sample.cache, samples: 0, requests: 0, phases: {}, errors: {} });
      const group = grouped.get(key);
      group.samples += 1;
      group.requests += sample.requests;
      for (const [reason, count] of Object.entries(sample.cacheMissReasons)) {
        group.cache_miss_reasons ??= {};
        group.cache_miss_reasons[reason] = (group.cache_miss_reasons[reason] ?? 0) + count;
      }
      for (const [name, value] of Object.entries(sample.phases)) (group.phases[name] ??= []).push(Math.round(value));
      for (const [code, count] of Object.entries(sample.errors)) group.errors[code] = (group.errors[code] ?? 0) + count;
    }
    const groups = [...grouped.values()].map(group => ({
      ...group,
      phases: Object.fromEntries(Object.entries(group.phases).map(([name, values]) => [name, stats(values)]))
    }));
    return { version: 1, sample_limit: MAX_SAMPLES, samples_retained: this.samples.length, groups };
  }

  clear() { this.samples.length = 0; for (const trace of this.active) trace.cancelled = true; this.active.clear(); this.renderSummary(); }

  mountPanel() {
    const panel = document.createElement('details');
    panel.id = 'performance-diagnostics';
    panel.style.cssText = 'position:fixed;z-index:2147483000;right:8px;bottom:8px;max-width:min(94vw,420px);max-height:55vh;overflow:auto;background:#fff;color:#111;border:1px solid #777;border-radius:8px;padding:8px;font:14px/1.4 system-ui;box-shadow:0 2px 12px #0004';
    const heading = document.createElement('summary'); heading.textContent = 'Đo tốc độ (chỉ trên thiết bị này)';
    const note = document.createElement('p'); note.textContent = 'Đang bật theo ?diag=1. Bộ đệm chỉ ở RAM và tối đa 120 mẫu.';
    const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Sao chép tổng hợp';
    const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Xóa mẫu';
    const output = document.createElement('textarea'); output.readOnly = true; output.rows = 5; output.style.cssText = 'box-sizing:border-box;width:100%;margin-top:8px'; output.setAttribute('aria-label', 'Kết quả đo tổng hợp'); output.hidden = true;
    const status = document.createElement('small'); status.setAttribute('role', 'status');
    copy.addEventListener('click', async () => {
      const text = JSON.stringify(this.summary(), null, 2);
      output.value = text; output.hidden = false;
      try { await navigator.clipboard.writeText(text); status.textContent = 'Đã sao chép tổng hợp.'; }
      catch { output.focus(); output.select(); status.textContent = 'Chọn phần tổng hợp trong ô bên dưới rồi sao chép.'; }
    });
    clear.addEventListener('click', () => { this.clear(); output.value = ''; status.textContent = 'Đã xóa mẫu trong bộ nhớ.'; });
    actions.append(copy, clear); panel.append(heading, note, actions, output, status); document.body.append(panel);
    this.panel = panel;
  }

  renderSummary() {
    // Export is generated only on explicit user action; no storage or network is used.
  }
}

function stats(values) {
  if (!values.length) return { count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = p => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
  return { count: values.length, p50_ms: at(.5), p95_ms: at(.95), min_ms: sorted[0], max_ms: sorted.at(-1) };
}
