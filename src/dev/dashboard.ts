import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { EventBus, EventStore } from "../core/events";

type DashboardOptions = {
  port: number;
  host?: string;
};

export class DevDashboard {
  private readonly eventStore: EventStore;
  private readonly eventBus: EventBus;
  private readonly port: number;
  private readonly host: string;
  private server: Server | null = null;
  private readonly sseClients = new Set<ServerResponse>();
  private unsubscribe: (() => void) | null = null;

  constructor(eventStore: EventStore, eventBus: EventBus, options: DashboardOptions) {
    this.eventStore = eventStore;
    this.eventBus = eventBus;
    this.port = options.port;
    this.host = options.host ?? "127.0.0.1";
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer((req, res) => {
      void this.handle(req, res);
    });

    await new Promise<void>((resolve) => {
      this.server?.listen(this.port, this.host, resolve);
    });

    this.unsubscribe = this.eventBus.subscribe((event) => {
      const payload = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of this.sseClients) {
        client.write(payload);
      }
    });
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;

    for (const client of this.sseClients) {
      client.end();
    }
    this.sseClients.clear();

    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server?.close((err) => (err ? reject(err) : resolve()));
    });

    this.server = null;
  }

  url(): string {
    return `http://${this.host}:${this.port}`;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${this.host}:${this.port}`);

    if (method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderHTML());
      return;
    }

    if (method === "GET" && url.pathname === "/api/events") {
      const limit = Number(url.searchParams.get("limit") ?? "300");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(this.eventStore.list(Number.isFinite(limit) ? limit : 300)));
      return;
    }

    if (method === "GET" && url.pathname === "/api/stats") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(this.eventStore.stats()));
      return;
    }

    if (method === "GET" && url.pathname === "/api/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });

      res.write(`data: ${JSON.stringify({ type: "connected", ts: Date.now() })}\n\n`);
      this.sseClients.add(res);

      req.on("close", () => {
        this.sseClients.delete(res);
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  }
}

function renderHTML(): string {
  return `<!doctype html>
<html lang="en" class="h-full dark" style="color-scheme: dark;">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TAS Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body { transition: opacity ease-in .2s; }
    :root { color-scheme: dark; }
    body {
      font-family: "Sora", "Manrope", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,.045), transparent 28%),
        linear-gradient(180deg, #090909 0%, #111214 100%);
      color: #e5e7eb;
      min-height: 100vh;
      overflow: hidden;
    }
    .bg-canvas { background: transparent; }
    .bg-panel { background: rgba(15,16,18,.92); backdrop-filter: blur(14px); }
    .bg-panel-2 { background: rgba(24,25,28,.96); }
    .bg-panel-3 { background: rgba(31,32,36,.98); }
    .border-subtle { border-color: rgba(255,255,255,.08); }
    .text-muted { color: #9ca3af; }
    .text-strong { color: #f3f4f6; }
    .run-row { transition: background-color .18s ease, transform .18s ease; }
    .run-row:hover { background: rgba(255,255,255,.035); }
    .timeline-grid { background-image: linear-gradient(to right, rgba(255,255,255,.08) 1px, transparent 1px); background-size: 25% 100%; }
    .scroll-thin::-webkit-scrollbar { width: 8px; height: 8px; }
    .scroll-thin::-webkit-scrollbar-thumb { background: rgba(115,115,115,.55); border-radius: 999px; }
    .animate-in { animation: in .18s ease-out; }
    .soft-shadow { box-shadow: 0 18px 44px rgba(0,0,0,.28); }
    .glass-line { background: linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent); }
    @keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body class="h-full bg-canvas">
  <div class="h-screen w-full flex">
    <aside class="w-56 shrink-0 border-r border-subtle bg-panel flex flex-col">
      <div class="px-4 pt-4 pb-3">
        <div class="text-2xl font-black tracking-tight text-strong">TAS</div>
        <div class="text-xs text-muted">Dev Dashboard</div>
      </div>
      <div class="px-4 text-[11px] uppercase tracking-[0.18em] text-muted">Monitor</div>
      <nav class="px-3 mt-2 space-y-1 text-sm">
        <button id="runsTabBtn" class="w-full text-left px-3 py-2 rounded-md bg-white/10 border border-white/15 text-slate-100 flex items-center gap-2 transition-colors">
          <i data-lucide="list" class="w-4 h-4"></i> Runs
        </button>
        <button id="eventsTabBtn" class="w-full text-left px-3 py-2 rounded-md hover:bg-panel-2 text-slate-300 flex items-center gap-2 transition-colors">
          <i data-lucide="message-square" class="w-4 h-4"></i> Events
        </button>
      </nav>
      <div class="mt-auto px-4 py-4 text-xs text-muted border-t border-subtle">
        Dashboard: 5173<br/>Webhook: 3000
      </div>
    </aside>

    <main class="flex-1 min-w-0 flex flex-col">
      <header class="h-12 px-4 border-b border-subtle bg-panel flex items-center justify-between">
        <div id="pageTitle" class="text-sm text-strong font-semibold">Runs</div>
        <div class="flex items-center gap-2">
          <button id="refreshBtn" class="text-xs px-3 py-1.5 rounded-md border border-subtle bg-panel-2 hover:bg-white/10 transition-colors">Refresh runs</button>
          <span class="text-[11px] px-2 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200">Live</span>
        </div>
      </header>

      <section id="runsFilters" class="p-3 border-b border-subtle bg-panel flex items-center gap-2 overflow-x-auto">
        <input id="searchInput" type="text" placeholder="Search message, chat, trigger, model" class="min-w-[280px] text-xs px-3 py-2 rounded-md border border-subtle bg-panel-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/20" />
        <select id="statusFilter" class="text-xs px-3 py-2 rounded-md border border-subtle bg-panel-2 text-slate-100 outline-none">
          <option value="all">Status: All</option>
          <option value="completed">Completed</option>
          <option value="running">Running</option>
          <option value="failed">Failed</option>
        </select>
        <select id="modelFilter" class="text-xs px-3 py-2 rounded-md border border-subtle bg-panel-2 text-slate-100 outline-none min-w-[180px]">
          <option value="all">Model: All</option>
        </select>
        <div class="ml-auto text-xs text-muted" id="runCount">0 messages</div>
      </section>

      <section id="runsView" class="min-h-0 flex-1 overflow-auto scroll-thin">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10 bg-panel border-b border-subtle">
            <tr>
              <th class="px-4 py-2 text-left text-xs text-muted font-medium">Status</th>
              <th class="px-4 py-2 text-left text-xs text-muted font-medium">Message</th>
              <th class="px-4 py-2 text-left text-xs text-muted font-medium">Trigger</th>
              <th class="px-4 py-2 text-left text-xs text-muted font-medium">Model / Runtime</th>
              <th class="px-4 py-2 text-left text-xs text-muted font-medium">Queued at</th>
              <th class="px-4 py-2 text-left text-xs text-muted font-medium">Duration</th>
            </tr>
          </thead>
          <tbody id="runsBody"></tbody>
        </table>
      </section>

      <section id="eventsView" class="hidden min-h-0 flex-1 overflow-auto scroll-thin">
        <div class="p-4">
          <div class="grid grid-cols-[180px_160px_180px_1fr] gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted border-b border-subtle">
            <div>Event</div>
            <div>Chat</div>
            <div>Timestamp</div>
            <div>Payload</div>
          </div>
          <div id="eventsBody" class="divide-y divide-white/5"></div>
        </div>
      </section>
    </main>
  </div>

  <script>
    const runsBody = document.getElementById('runsBody');
    const eventsBody = document.getElementById('eventsBody');
    const runCount = document.getElementById('runCount');
    const refreshBtn = document.getElementById('refreshBtn');
    const pageTitle = document.getElementById('pageTitle');
    const runsTabBtn = document.getElementById('runsTabBtn');
    const eventsTabBtn = document.getElementById('eventsTabBtn');
    const runsView = document.getElementById('runsView');
    const eventsView = document.getElementById('eventsView');
    const runsFilters = document.getElementById('runsFilters');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const modelFilter = document.getElementById('modelFilter');

    let events = [];
    let expandedRunId = null;
    let activeTab = 'runs';
    let filters = {
      search: '',
      status: 'all',
      model: 'all'
    };

    function statusOf(run) {
      if (run.events.some((e) => e.event === 'runtime_error')) return { label: 'Failed', cls: 'bg-red-500/12 text-red-200 border-red-400/20' };
      if (run.events.some((e) => e.event === 'response_sent')) return { label: 'Completed', cls: 'bg-emerald-500/12 text-emerald-200 border-emerald-400/20' };
      return { label: 'Running', cls: 'bg-white/10 text-slate-100 border-white/15' };
    }

    function byRun(items) {
      const eventsByChat = new Map();
      for (const ev of items) {
        const chatId = ev.chatId || 'global';
        if (!eventsByChat.has(chatId)) eventsByChat.set(chatId, []);
        eventsByChat.get(chatId).push(ev);
      }

      const rows = [];
      for (const [chatId, chatEvents] of eventsByChat.entries()) {
        chatEvents.sort((a, b) => a.ts - b.ts);
        let current = null;
        let sequence = 0;

        for (const ev of chatEvents) {
          if (ev.event === 'message_received') {
            if (current) {
              rows.push(finalizeRun(current));
            }

            sequence += 1;
            current = {
              runId: chatId + ':' + sequence + ':' + ev.ts,
              chatId,
              sequence,
              startedAt: ev.ts,
              events: [ev]
            };
            continue;
          }

          if (!current) {
            sequence += 1;
            current = {
              runId: chatId + ':' + sequence + ':' + ev.ts,
              chatId,
              sequence,
              startedAt: ev.ts,
              events: [ev]
            };
            continue;
          }

          current.events.push(ev);

          if (ev.event === 'response_sent' || ev.event === 'runtime_error') {
            rows.push(finalizeRun(current));
            current = null;
          }
        }

        if (current) {
          rows.push(finalizeRun(current));
        }
      }

      rows.sort((a, b) => b.queuedAt - a.queuedAt);
      return rows;
    }

    function finalizeRun(run) {
      const first = run.events[0];
      const last = run.events[run.events.length - 1];
      const received = run.events.find((e) => e.event === 'message_received');
      const text = received && received.payload ? received.payload.text : null;

      return {
        runId: run.runId,
        chatId: run.chatId,
        sequence: run.sequence,
        messageText: text ? String(text) : '(system event)',
        trigger: inferTrigger(run.events),
        fn: inferFunction(run.events),
        queuedAt: first?.ts || Date.now(),
        endedAt: last?.ts || Date.now(),
        duration: Math.max(0, (last?.ts || 0) - (first?.ts || 0)),
        events: run.events
      };
    }

    function inferTrigger(items) {
      const got = items.find((e) => e.event === 'message_received');
      return got ? 'telegram/message.received' : 'runtime/internal';
    }

    function inferFunction(items) {
      const got = items.find((e) => e.event === 'llm_called');
      const model = got && got.payload ? got.payload.model : null;
      return model ? String(model) : 'telegram-agent-runtime';
    }

    function fmt(ts) {
      try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
    }

    function dur(ms) {
      if (ms < 1000) return ms + 'ms';
      if (ms < 60000) return (ms / 1000).toFixed(2) + 's';
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      return m + 'm ' + s + 's';
    }

    function esc(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function renderRunsWithData(runs) {
      runCount.textContent = runs.length + ' messages';

      let html = '';
      for (const run of runs) {
        const st = statusOf(run);

        html += '<tr class="run-row border-b border-white/5 cursor-pointer" data-run="' + esc(run.runId) + '">';
        html += '<td class="px-4 py-2"><span class="px-2 py-1 text-xs rounded-full border ' + st.cls + '">' + st.label + '</span></td>';
        html += '<td class="px-4 py-2">';
        html += '<div class="max-w-[360px]">';
        html += '<div class="text-strong font-medium truncate">' + esc(run.messageText) + '</div>';
        html += '<div class="text-[11px] text-muted mt-0.5">Chat ' + esc(run.chatId) + ' | Msg #' + esc(run.sequence) + '</div>';
        html += '</div>';
        html += '</td>';
        html += '<td class="px-4 py-2 text-muted">' + esc(run.trigger) + '</td>';
        html += '<td class="px-4 py-2 text-strong font-medium">' + esc(run.fn) + '</td>';
        html += '<td class="px-4 py-2 text-muted">' + esc(fmt(run.queuedAt)) + '</td>';
        html += '<td class="px-4 py-2 text-muted">' + esc(dur(run.duration)) + '</td>';
        html += '</tr>';

        const open = expandedRunId === run.runId;
        html += '<tr class="' + (open ? '' : 'hidden') + '" data-detail="' + esc(run.runId) + '"><td colspan="6" class="bg-panel-2 border-b border-subtle">';
        html += renderRunDetail(run);
        html += '</td></tr>';
      }

      runsBody.innerHTML = html || '<tr><td colspan="6" class="px-4 py-8 text-sm text-muted">No matching message runs.</td></tr>';

      runsBody.querySelectorAll('tr[data-run]').forEach((row) => {
        row.addEventListener('click', () => {
          const id = row.getAttribute('data-run');
          expandedRunId = expandedRunId === id ? null : id;
          renderActiveView();
        });
      });
    }

    function renderRunDetail(run) {
      const min = run.events[0]?.ts || 0;
      const max = run.events[run.events.length - 1]?.ts || min + 1;
      const total = Math.max(1, max - min);

      let bars = '';
      for (let i = 0; i < run.events.length; i += 1) {
        const ev = run.events[i];
        const nextTs = i < run.events.length - 1 ? run.events[i + 1].ts : max;
        const left = ((ev.ts - min) / total) * 100;
        const width = Math.max(0.8, ((nextTs - ev.ts) / total) * 100);
        const color = colorFor(ev.event);

        bars += '<div class="relative isolate flex h-7 items-center">';
        bars += '<div class="w-[35%] pr-3 text-xs text-slate-200 flex items-center justify-between">';
        bars += '<span class="truncate">' + esc(ev.event) + '</span>';
        bars += '<span class="text-muted tabular-nums">' + esc(dur(Math.max(0, nextTs - ev.ts))) + '</span>';
        bars += '</div>';
        bars += '<div class="w-[65%] relative h-4 timeline-grid">';
        bars += '<div class="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-px bg-white/8"></div>';
        bars += '<div class="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm ' + color + '" style="left:' + left.toFixed(3) + '%;width:' + width.toFixed(3) + '%"></div>';
        bars += '</div>';
        bars += '</div>';
      }

      let payloads = '';
      for (const ev of run.events.slice().reverse()) {
        payloads += '<div class="rounded-xl border border-subtle bg-panel-3 p-3 animate-in soft-shadow">';
        payloads += '<div class="flex items-center justify-between text-xs">';
        payloads += '<span class="px-2 py-0.5 rounded-full border ' + chipFor(ev.event) + '">' + esc(ev.event) + '</span>';
        payloads += '<span class="text-muted">' + esc(fmt(ev.ts)) + '</span>';
        payloads += '</div>';
        payloads += '<pre class="mt-2 text-xs text-slate-300 whitespace-pre-wrap break-words">' + esc(JSON.stringify(ev.payload, null, 2)) + '</pre>';
        payloads += '</div>';
      }

      const duration = max - min;

      return '' +
        '<div class="p-4 grid grid-cols-[58%_42%] gap-4">' +
          '<div>' +
            '<div class="flex items-center justify-between mb-2">' +
              '<div>' +
                '<div class="text-sm font-semibold text-strong">Trace Timeline</div>' +
                '<div class="text-xs text-muted mt-1">Chat ' + esc(run.chatId) + ' | Message #' + esc(run.sequence) + '</div>' +
              '</div>' +
              '<div class="text-xs text-muted">Duration: ' + esc(dur(duration)) + '</div>' +
            '</div>' +
            '<div class="rounded-xl border border-subtle bg-panel-3 p-3 soft-shadow">' + bars + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="text-sm font-semibold text-strong mb-2">Live Event Data</div>' +
            '<div class="space-y-2 max-h-[360px] overflow-auto scroll-thin">' + payloads + '</div>' +
          '</div>' +
        '</div>';
    }

    function chipFor(name) {
      if (name === 'runtime_error') return 'bg-red-500/12 text-red-200 border-red-400/20';
      if (name === 'tool_called') return 'bg-zinc-500/18 text-zinc-100 border-zinc-400/20';
      if (name === 'llm_called') return 'bg-neutral-500/18 text-neutral-100 border-neutral-400/20';
      if (name === 'response_sent') return 'bg-emerald-500/12 text-emerald-200 border-emerald-400/20';
      return 'bg-white/8 text-slate-200 border-white/10';
    }

    function colorFor(name) {
      if (name === 'runtime_error') return 'bg-red-500';
      if (name === 'tool_called') return 'bg-zinc-400';
      if (name === 'llm_called') return 'bg-neutral-300';
      if (name === 'response_sent') return 'bg-emerald-500';
      return 'bg-slate-500';
    }

    function applyRunFilters(runs) {
      return runs.filter((run) => {
        if (filters.status !== 'all') {
          const currentStatus = statusOf(run).label.toLowerCase();
          if (currentStatus !== filters.status) {
            return false;
          }
        }

        if (filters.model !== 'all' && run.fn !== filters.model) {
          return false;
        }

        if (filters.search) {
          const haystack = [run.messageText, run.chatId, run.trigger, run.fn].join(' ').toLowerCase();
          if (!haystack.includes(filters.search)) {
            return false;
          }
        }

        return true;
      });
    }

    function refreshModelFilter(runs) {
      const previous = filters.model;
      const models = Array.from(new Set(runs.map((run) => run.fn))).sort((a, b) => a.localeCompare(b));
      let html = '<option value="all">Model: All</option>';
      for (const model of models) {
        html += '<option value="' + esc(model) + '">' + esc(model) + '</option>';
      }
      modelFilter.innerHTML = html;

      if (previous !== 'all' && models.includes(previous)) {
        modelFilter.value = previous;
      } else {
        modelFilter.value = 'all';
        filters.model = 'all';
      }
    }

    function renderEvents() {
      const sorted = events.slice().sort((a, b) => b.ts - a.ts);
      runCount.textContent = sorted.length + ' events';

      let html = '';
      for (const ev of sorted) {
        html += '<div class="grid grid-cols-[180px_160px_180px_1fr] gap-3 px-3 py-3 text-sm hover:bg-white/[0.03] transition-colors">';
        html += '<div><span class="px-2 py-1 text-xs rounded-full border ' + chipFor(ev.event) + '">' + esc(ev.event) + '</span></div>';
        html += '<div class="text-muted font-mono text-xs self-center">' + esc(ev.chatId || 'global') + '</div>';
        html += '<div class="text-muted text-xs self-center">' + esc(fmt(ev.ts)) + '</div>';
        html += '<pre class="text-xs text-slate-300 whitespace-pre-wrap break-words m-0">' + esc(JSON.stringify(ev.payload, null, 2)) + '</pre>';
        html += '</div>';
      }

      eventsBody.innerHTML = html || '<div class="px-3 py-6 text-sm text-muted">No events yet.</div>';
    }

    function setActiveTab(tab) {
      const isRuns = tab === 'runs';
      activeTab = tab;
      pageTitle.textContent = isRuns ? 'Runs' : 'Events';
      refreshBtn.textContent = isRuns ? 'Refresh runs' : 'Refresh events';
      runsView.classList.toggle('hidden', !isRuns);
      eventsView.classList.toggle('hidden', isRuns);
      runsFilters.classList.toggle('hidden', !isRuns);
      runsTabBtn.className = isRuns
        ? 'w-full text-left px-3 py-2 rounded-md bg-white/10 border border-white/15 text-slate-100 flex items-center gap-2 transition-colors'
        : 'w-full text-left px-3 py-2 rounded-md hover:bg-panel-2 text-slate-300 flex items-center gap-2 transition-colors';
      eventsTabBtn.className = isRuns
        ? 'w-full text-left px-3 py-2 rounded-md hover:bg-panel-2 text-slate-300 flex items-center gap-2 transition-colors'
        : 'w-full text-left px-3 py-2 rounded-md bg-white/10 border border-white/15 text-slate-100 flex items-center gap-2 transition-colors';
      renderActiveView();
    }

    function renderActiveView() {
      if (activeTab === 'events') {
        renderEvents();
        return;
      }

      const runs = byRun(events);
      refreshModelFilter(runs);
      renderRunsWithData(applyRunFilters(runs));
    }

    async function bootstrap() {
      const res = await fetch('/api/events?limit=1000');
      events = await res.json();
      renderActiveView();
    }

    function connect() {
      const es = new EventSource('/api/stream');
      es.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        if (!data || !data.event) return;
        events.push(data);
        if (events.length > 2000) events = events.slice(events.length - 2000);
        renderActiveView();
      };
      es.onerror = () => {
        es.close();
        setTimeout(connect, 1000);
      };
    }

    refreshBtn.addEventListener('click', () => {
      void bootstrap();
    });

    runsTabBtn.addEventListener('click', () => {
      setActiveTab('runs');
    });

    eventsTabBtn.addEventListener('click', () => {
      setActiveTab('events');
    });

    searchInput.addEventListener('input', () => {
      filters.search = searchInput.value.trim().toLowerCase();
      renderActiveView();
    });

    statusFilter.addEventListener('change', () => {
      filters.status = statusFilter.value;
      renderActiveView();
    });

    modelFilter.addEventListener('change', () => {
      filters.model = modelFilter.value;
      renderActiveView();
    });

    lucide.createIcons();
    bootstrap().then(connect);
  </script>
</body>
</html>`;
}
