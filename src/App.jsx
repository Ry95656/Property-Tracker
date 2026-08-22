import { useState, useEffect, useMemo } from "react";
import {
  DollarSign, Wrench, CalendarDays, Plus, X, Trash2,
  ChevronLeft, ChevronRight, Pencil, Check, Home, MessageSquare, Camera, AlertTriangle,
} from "lucide-react";
import { storage } from "./storage";

const STORAGE_KEY = "ledger-data";

const SEED = {
  properties: [
    { id: "p1", name: "142 Maple St", address: "142 Maple St, Springfield", type: "Multi-unit", notes: "4-unit walk-up." },
    { id: "p2", name: "9 Birch Lane", address: "9 Birch Lane, Springfield", type: "House", notes: "Single-family rental." },
  ],
  tenants: [
    { id: "t1", name: "Marcus Webb", propertyId: "p1", unit: "2B", rentAmount: 1450, dueDay: 1, lastPaidPeriod: "2026-06" },
    { id: "t2", name: "Priya Nair", propertyId: "p1", unit: "1A", rentAmount: 1200, dueDay: 5, lastPaidPeriod: "2026-07" },
    { id: "t3", name: "Sam O'Rourke", propertyId: "p1", unit: "3C", rentAmount: 1600, dueDay: 25, lastPaidPeriod: "2026-06" },
  ],
  repairs: [
    { id: "r1", title: "Leaking kitchen faucet", propertyId: "p1", unit: "1A", priority: "Medium", status: "Open", dateReported: "2026-07-14", notes: "Steady drip under the sink.", photoIds: [] },
    { id: "r2", title: "AC not cooling", propertyId: "p1", unit: "2B", priority: "High", status: "In Progress", dateReported: "2026-07-10", notes: "Technician scheduled, waiting on a part.", photoIds: [] },
    { id: "r3", title: "Squeaky front door hinge", propertyId: "p2", unit: "", priority: "Low", status: "Done", dateReported: "2026-06-28", notes: "Oiled the hinge.", photoIds: [] },
  ],
  complaints: [
    { id: "c1", title: "Late-night noise from 2B", propertyId: "p1", unit: "1A", filedBy: "Priya Nair", category: "Noise", status: "Open", dateReported: "2026-07-16", notes: "Music after midnight, twice this week." },
    { id: "c2", title: "Guest parking in reserved spot", propertyId: "p1", unit: "3C", filedBy: "Marcus Webb", category: "Parking", status: "Reviewing", dateReported: "2026-07-11", notes: "" },
    { id: "c3", title: "Shared fence dispute", propertyId: "p2", unit: "", filedBy: "Neighbor", category: "Neighbor Dispute", status: "Resolved", dateReported: "2026-06-20", notes: "Resolved by splitting repair cost." },
  ],
  appointments: [
    { id: "a1", title: "HVAC technician visit", person: "Cool Air Co.", propertyId: "p1", unit: "2B", date: "2026-07-22", time: "10:00", notes: "Bring a replacement capacitor." },
    { id: "a2", title: "Plumber - faucet repair", person: "Dana", propertyId: "p1", unit: "1A", date: "2026-07-24", time: "14:00", notes: "" },
    { id: "a3", title: "Move-in walkthrough", person: "New tenant", propertyId: "p2", unit: "", date: "2026-07-30", time: "09:30", notes: "" },
  ],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function formatCurrency(n) {
  return `$${Number(n || 0).toLocaleString("en-US")}`;
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function currentPeriod() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
function getRentStatus(tenant) {
  if (tenant.lastPaidPeriod >= currentPeriod()) return "PAID";
  const todayDay = new Date().getDate();
  return todayDay > tenant.dueDay ? "OVERDUE" : "DUE";
}
function propName(properties, id) {
  return properties.find((p) => p.id === id)?.name || "Unassigned";
}
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function StampBadge({ label, tone }) {
  const toneClass = tone === "red" ? "stamp-red" : tone === "green" ? "stamp-green" : "stamp-navy";
  return <span className={`stamp ${toneClass}`}>{label}</span>;
}

function LedgerInput({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
      {label}
      <input {...props} className="ledger-input" />
    </label>
  );
}

function PropertySelect({ properties, value, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
      Property
      <select className="ledger-input" value={value || ""} onChange={onChange}>
        <option value="">Unassigned</option>
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}

function RentBarChart({ paid, due, overdue }) {
  const bars = [
    { label: "PAID", value: paid, color: "var(--chart-green)" },
    { label: "DUE", value: due, color: "var(--chart-navy)" },
    { label: "OVERDUE", value: overdue, color: "var(--chart-red)" },
  ];
  const max = Math.max(paid, due, overdue, 1);
  const chartH = 100, barW = 44, gap = 26, width = bars.length * (barW + gap);
  return (
    <svg viewBox={`0 0 ${width} ${chartH + 26}`} className="w-full h-32">
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="0" x2={width} y1={chartH - (i * chartH) / 3} y2={chartH - (i * chartH) / 3} stroke="var(--rule)" strokeWidth="1" />
      ))}
      {bars.map((b, i) => {
        const h = (b.value / max) * chartH;
        const x = i * (barW + gap) + gap / 2;
        return (
          <g key={b.label}>
            <rect x={x} y={chartH - h} width={barW} height={Math.max(h, 1)} fill={b.color} rx="2" />
            <text x={x + barW / 2} y={chartH - h - 6} textAnchor="middle" fontSize="11" fill="var(--ink)" fontFamily="IBM Plex Mono, monospace">{b.value}</text>
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize="9" letterSpacing="0.5" fill="var(--ink-soft)" fontFamily="IBM Plex Mono, monospace">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function CollectedBar({ collected, outstanding }) {
  const total = collected + outstanding || 1;
  const pct = (collected / total) * 100;
  return (
    <div>
      <div className="w-full h-5 rounded-sm overflow-hidden flex" style={{ border: "1px solid var(--rule)" }}>
        <div style={{ width: `${pct}%`, background: "var(--chart-green)" }} />
        <div style={{ width: `${100 - pct}%`, background: "var(--chart-red)" }} />
      </div>
      <div className="flex justify-between text-[11px] mt-1 font-mono" style={{ color: "var(--ink-soft)" }}>
        <span>Collected {formatCurrency(collected)}</span>
        <span>Outstanding {formatCurrency(outstanding)}</span>
      </div>
    </div>
  );
}

function RepairsDonut({ open, inProgress, done }) {
  const total = open + inProgress + done || 1;
  const segs = [
    { value: open, color: "var(--chart-red)" },
    { value: inProgress, color: "var(--chart-amber)" },
    { value: done, color: "var(--chart-green)" },
  ];
  const r = 38, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--rule)" strokeWidth="13" />
      {segs.map((s, i) => {
        const dash = (s.value / total) * circ;
        const node = (
          <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="13"
            strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset}
            transform="rotate(-90 50 50)" strokeLinecap="butt" />
        );
        offset += dash;
        return node;
      })}
      <text x="50" y="55" textAnchor="middle" fontSize="20" fontFamily="IBM Plex Mono, monospace" fill="var(--ink)">{total}</text>
    </svg>
  );
}

function AppointmentCalendar({ cursor, setCursor, appointmentsByDate, selectedDate, onSelectDay }) {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const monthLabel = first.toLocaleString("en-US", { month: "long", year: "numeric" });
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1.5 rounded-md transition hover:bg-black/5" style={{ color: "var(--ink)" }}>
          <ChevronLeft size={18} />
        </button>
        <span className="font-mono text-sm tracking-wide" style={{ color: "var(--ink)" }}>{monthLabel}</span>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1.5 rounded-md transition hover:bg-black/5" style={{ color: "var(--ink)" }}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-mono mb-1" style={{ color: "var(--ink-soft)" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dayAppts = appointmentsByDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          return (
            <button key={i} onClick={() => onSelectDay(dateStr)}
              className="calendar-day aspect-square rounded-sm p-1 text-left flex flex-col items-start overflow-hidden"
              style={{
                border: "1px solid var(--rule)",
                background: isSelected ? "rgba(201,123,69,0.15)" : "transparent",
                outline: isToday ? "2px solid var(--kraft)" : "none",
                outlineOffset: "-1px",
              }}>
              <span className="text-[10px] font-mono" style={{ color: "var(--ink-soft)" }}>{d}</span>
              {dayAppts.slice(0, 2).map((a) => (
                <span key={a.id} className="block w-full truncate text-[9px] font-mono px-1 mt-0.5 rounded-sm" style={{ background: "var(--ink)", color: "var(--paper)" }}>
                  {a.title}
                </span>
              ))}
              {dayAppts.length > 2 && <span className="text-[9px] font-mono" style={{ color: "var(--ink-soft)" }}>+{dayAppts.length - 2} more</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TABS = [
  { id: "properties", label: "Properties", icon: Home },
  { id: "rent", label: "Rent Ledger", icon: DollarSign },
  { id: "repairs", label: "Repairs", icon: Wrench },
  { id: "complaints", label: "Complaints", icon: MessageSquare },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
];

export default function PropertyLedger() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("properties");

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY, false);
        setData(res && res.value ? JSON.parse(res.value) : SEED);
      } catch {
        setData(SEED);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading || !data) return;
    storage.set(STORAGE_KEY, JSON.stringify(data), false).catch(() => {});
  }, [data, loading]);

  const properties = data?.properties || [];
  const tenants = data?.tenants || [];
  const repairs = data?.repairs || [];
  const complaints = data?.complaints || [];
  const appointments = data?.appointments || [];

  const rentStatuses = useMemo(() => tenants.map((t) => ({ ...t, status: getRentStatus(t) })), [tenants]);
  const paidCount = rentStatuses.filter((t) => t.status === "PAID").length;
  const dueCount = rentStatuses.filter((t) => t.status === "DUE").length;
  const overdueCount = rentStatuses.filter((t) => t.status === "OVERDUE").length;
  const collected = rentStatuses.filter((t) => t.status === "PAID").reduce((s, t) => s + Number(t.rentAmount), 0);
  const outstanding = rentStatuses.filter((t) => t.status !== "PAID").reduce((s, t) => s + Number(t.rentAmount), 0);

  const openRepairs = repairs.filter((r) => r.status === "Open").length;
  const inProgressRepairs = repairs.filter((r) => r.status === "In Progress").length;
  const doneRepairs = repairs.filter((r) => r.status === "Done").length;
  const openComplaints = complaints.filter((c) => c.status !== "Resolved").length;

  const in7Days = useMemo(() => {
    const now = new Date();
    const future = new Date(); future.setDate(now.getDate() + 7);
    return appointments.filter((a) => {
      const d = new Date(a.date + "T00:00:00");
      return d >= new Date(now.toDateString()) && d <= future;
    }).length;
  }, [appointments]);

  function update(section, items) {
    setData((prev) => ({ ...prev, [section]: items }));
  }
  function addItem(section, item) {
    update(section, [...(data[section] || []), { id: uid(), ...item }]);
  }
  function editItem(section, id, patch) {
    update(section, data[section].map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function deleteItem(section, id) {
    update(section, data[section].filter((it) => it.id !== id));
  }

  if (loading) {
    return (
      <div className="ledger-app flex items-center justify-center min-h-[400px]">
        <span className="font-mono text-sm" style={{ color: "var(--ink-soft)" }}>Opening the ledger…</span>
      </div>
    );
  }

  return (
    <div className="ledger-app min-h-screen w-full flex" style={{ background: "var(--paper)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Special+Elite&family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600;700&display=swap');
        .ledger-app { --paper:#E8ECE1; --paper-deep:#DCE3D5; --rule:#B7C9AE; --ink:#1E2A2F; --ink-soft:#3A4640; --red:#A63A2E; --green:#3F6B4A; --kraft:#C97B45; --chart-navy:#141F26; --chart-green:#1F3A2A; --chart-red:#6E2318; --chart-amber:#7A4413; font-family:'Inter',sans-serif; color:var(--ink); }
        .ledger-app .ledger-serif { font-family:'Special Elite',monospace; }
        .ledger-app .ledger-mono { font-family:'IBM Plex Mono',monospace; }
        .ledger-app .ledger-lines { background-image: repeating-linear-gradient(to bottom, transparent, transparent 39px, var(--rule) 39px, var(--rule) 40px); }
        .ledger-app .stamp { font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; }
        .ledger-app .stamp-red { color:var(--red); }
        .ledger-app .stamp-green { color:var(--green); }
        .ledger-app .stamp-navy { color:var(--ink); }
        .ledger-app .ledger-input { background:transparent; border:none; border-bottom:1px solid var(--rule); padding:5px 2px; font-family:'Inter',sans-serif; color:var(--ink); transition:border-color .15s ease, background-color .15s ease; }
        .ledger-app .ledger-input:focus { outline:none; border-bottom:1px solid var(--kraft); background:rgba(201,123,69,0.05); }
        .ledger-app .folder-tab { transition:filter .15s ease, box-shadow .15s ease; }
        .ledger-app .folder-tab:hover { filter:brightness(1.08); }
        .ledger-app .folder-tab.active { box-shadow:0 2px 6px rgba(30,42,47,0.15); }
        .ledger-app .folder-tab.active:hover { filter:none; }
        .ledger-app .card { background: var(--paper-deep); border:1px solid var(--rule); border-radius:8px; box-shadow:0 1px 3px rgba(30,42,47,0.07); }
        .ledger-app .card-hover { transition:transform .15s ease, box-shadow .15s ease; }
        .ledger-app .card-hover:hover { transform:translateY(-2px); box-shadow:0 6px 14px rgba(30,42,47,0.12); }
        .ledger-app .ledger-row { border-radius:5px; transition:background-color .12s ease; }
        .ledger-app .ledger-row:hover { background-color:rgba(30,42,47,0.045); }
        .ledger-app .calendar-day:hover { background-color:rgba(201,123,69,0.12) !important; }
      `}</style>

      <div className="w-16 shrink-0" style={{ background: "var(--ink)" }} />

      <div className="w-16 sm:w-44 shrink-0 flex flex-col gap-2 pt-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`folder-tab flex items-center gap-2 pl-5 pr-3 sm:pr-4 py-3 rounded-r-md text-xs sm:text-sm font-semibold ${active ? "active" : ""}`}
              style={{
                background: active ? "var(--paper)" : "var(--kraft)",
                color: active ? "var(--ink)" : "#fff",
              }}>
              <Icon size={16} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0 p-4 sm:p-8">
        <h1 className="ledger-serif text-2xl sm:text-3xl mb-2">Property Ledger</h1>
        <p className="text-xs mb-6" style={{ color: "var(--ink-soft)" }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="card px-4 py-3 mb-8 flex flex-wrap gap-x-6 gap-y-2 ledger-mono text-xs items-center">
          <span className="flex items-center gap-1.5"><Home size={13} style={{ color: "var(--ink-soft)" }} /><strong>{properties.length}</strong> properties</span>
          <span className="flex items-center gap-1.5"><DollarSign size={13} style={{ color: "var(--ink-soft)" }} /><strong>{tenants.length}</strong> units</span>
          <span className="flex items-center gap-1.5"><Check size={13} style={{ color: "var(--green)" }} /><strong style={{ color: "var(--green)" }}>{formatCurrency(collected)}</strong> collected</span>
          <span className="flex items-center gap-1.5"><AlertTriangle size={13} style={{ color: overdueCount ? "var(--red)" : "var(--ink-soft)" }} /><strong style={{ color: overdueCount ? "var(--red)" : "var(--ink)" }}>{overdueCount}</strong> overdue</span>
          <span className="flex items-center gap-1.5"><Wrench size={13} style={{ color: "var(--ink-soft)" }} /><strong>{openRepairs + inProgressRepairs}</strong> open repairs</span>
          <span className="flex items-center gap-1.5"><MessageSquare size={13} style={{ color: "var(--ink-soft)" }} /><strong>{openComplaints}</strong> open complaints</span>
          <span className="flex items-center gap-1.5"><CalendarDays size={13} style={{ color: "var(--ink-soft)" }} /><strong>{in7Days}</strong> appointments next 7 days</span>
        </div>

        {tab === "properties" && (
          <PropertiesTab
            properties={properties} tenants={tenants} repairs={repairs} complaints={complaints}
            onAdd={(p) => addItem("properties", p)}
            onEdit={(id, patch) => editItem("properties", id, patch)}
            onDelete={(id) => deleteItem("properties", id)}
          />
        )}
        {tab === "rent" && (
          <RentTab
            tenants={rentStatuses} properties={properties}
            onAdd={(t) => addItem("tenants", t)}
            onEdit={(id, patch) => editItem("tenants", id, patch)}
            onDelete={(id) => deleteItem("tenants", id)}
            paidCount={paidCount} dueCount={dueCount} overdueCount={overdueCount}
            collected={collected} outstanding={outstanding}
          />
        )}
        {tab === "repairs" && (
          <RepairsTab
            repairs={repairs} properties={properties}
            onAdd={(r) => addItem("repairs", r)}
            onEdit={(id, patch) => editItem("repairs", id, patch)}
            onDelete={(id) => deleteItem("repairs", id)}
            open={openRepairs} inProgress={inProgressRepairs} done={doneRepairs}
          />
        )}
        {tab === "complaints" && (
          <ComplaintsTab
            complaints={complaints} properties={properties}
            onAdd={(c) => addItem("complaints", c)}
            onEdit={(id, patch) => editItem("complaints", id, patch)}
            onDelete={(id) => deleteItem("complaints", id)}
          />
        )}
        {tab === "appointments" && (
          <AppointmentsTab
            appointments={appointments} properties={properties}
            onAdd={(a) => addItem("appointments", a)}
            onEdit={(id, patch) => editItem("appointments", id, patch)}
            onDelete={(id) => deleteItem("appointments", id)}
          />
        )}
      </div>
    </div>
  );
}

function PropertiesTab({ properties, tenants, repairs, complaints, onAdd, onEdit, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: "", address: "", type: "House", notes: "" });

  function openAdd() { setDraft({ name: "", address: "", type: "House", notes: "" }); setEditingId(null); setShowForm(true); }
  function openEdit(p) { setDraft({ name: p.name, address: p.address, type: p.type, notes: p.notes }); setEditingId(p.id); setShowForm(true); }
  function save() {
    if (!draft.name) return;
    if (editingId) onEdit(editingId, draft);
    else onAdd(draft);
    setShowForm(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="ledger-serif text-sm">Properties</p>
        <button onClick={openAdd} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-125" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          <Plus size={14} /> Add property
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4 grid sm:grid-cols-2 gap-3">
          <LedgerInput label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <LedgerInput label="Address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
            Type
            <select className="ledger-input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option>House</option><option>Apartment</option><option>Condo</option><option>Townhouse</option><option>Multi-unit</option>
            </select>
          </label>
          <LedgerInput label="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <div className="sm:col-span-2 flex gap-2">
            <button onClick={save} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-110" style={{ background: "var(--green)", color: "#fff" }}><Check size={14} /> Save</button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:bg-black/5" style={{ border: "1px solid var(--rule)" }}><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {properties.map((p) => {
          const tCount = tenants.filter((t) => t.propertyId === p.id).length;
          const rCount = repairs.filter((r) => r.propertyId === p.id && r.status !== "Done").length;
          const cCount = complaints.filter((c) => c.propertyId === p.id && c.status !== "Resolved").length;
          return (
            <div key={p.id} className="card card-hover p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{p.address}</p>
                </div>
                <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--ink-soft)" }}>{p.type?.toUpperCase()}</span>
              </div>
              {p.notes && <p className="text-xs mt-2" style={{ color: "var(--ink-soft)" }}>{p.notes}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 ledger-mono text-xs" style={{ color: "var(--ink-soft)" }}>
                <span>{tCount} tenant{tCount !== 1 ? "s" : ""}</span>
                <span>{rCount} open repair{rCount !== 1 ? "s" : ""}</span>
                <span>{cCount} open complaint{cCount !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-md transition hover:bg-black/5" style={{ color: "var(--ink-soft)" }}><Pencil size={14} /></button>
                <button onClick={() => onDelete(p.id)} className="p-1.5 rounded-md transition hover:bg-red-50" style={{ color: "var(--red)" }}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
        {properties.length === 0 && <p className="text-sm py-6" style={{ color: "var(--ink-soft)" }}>No properties yet.</p>}
      </div>
    </div>
  );
}

function RentTab({ tenants, properties, onAdd, onEdit, onDelete, paidCount, dueCount, overdueCount, collected, outstanding }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: "", propertyId: "", unit: "", rentAmount: "", dueDay: "" });

  function openAdd() { setDraft({ name: "", propertyId: "", unit: "", rentAmount: "", dueDay: "" }); setEditingId(null); setShowForm(true); }
  function openEdit(t) { setDraft({ name: t.name, propertyId: t.propertyId || "", unit: t.unit, rentAmount: t.rentAmount, dueDay: t.dueDay }); setEditingId(t.id); setShowForm(true); }
  function save() {
    if (!draft.name || !draft.rentAmount || !draft.dueDay) return;
    const payload = { name: draft.name, propertyId: draft.propertyId, unit: draft.unit, rentAmount: Number(draft.rentAmount), dueDay: Number(draft.dueDay) };
    if (editingId) onEdit(editingId, payload);
    else onAdd({ ...payload, lastPaidPeriod: "1970-01" });
    setShowForm(false);
  }

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        <div className="card p-4">
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--ink-soft)" }}>THIS MONTH BY STATUS</p>
          <RentBarChart paid={paidCount} due={dueCount} overdue={overdueCount} />
        </div>
        <div className="card p-4 flex flex-col justify-center">
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--ink-soft)" }}>COLLECTED VS OUTSTANDING</p>
          <CollectedBar collected={collected} outstanding={outstanding} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="ledger-serif text-sm">Tenants</p>
        <button onClick={openAdd} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-125" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          <Plus size={14} /> Add tenant
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4 grid sm:grid-cols-4 gap-3 items-end">
          <LedgerInput label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <PropertySelect properties={properties} value={draft.propertyId} onChange={(e) => setDraft({ ...draft, propertyId: e.target.value })} />
          <LedgerInput label="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          <LedgerInput label="Rent ($)" type="number" value={draft.rentAmount} onChange={(e) => setDraft({ ...draft, rentAmount: e.target.value })} />
          <LedgerInput label="Due day (1-31)" type="number" min="1" max="31" value={draft.dueDay} onChange={(e) => setDraft({ ...draft, dueDay: e.target.value })} />
          <div className="sm:col-span-4 flex gap-2">
            <button onClick={save} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-110" style={{ background: "var(--green)", color: "#fff" }}><Check size={14} /> Save</button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:bg-black/5" style={{ border: "1px solid var(--rule)" }}><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="ledger-lines">
        {tenants.map((t) => (
          <div key={t.id} className="ledger-row flex flex-wrap items-center gap-3 py-2.5 px-2 -mx-2">
            <span className="w-32 font-medium truncate">{t.name}</span>
            <span className="w-32 text-xs ledger-mono truncate" style={{ color: "var(--ink-soft)" }}>{propName(properties, t.propertyId)}{t.unit ? ` · ${t.unit}` : ""}</span>
            <span className="w-20 ledger-mono text-sm">{formatCurrency(t.rentAmount)}</span>
            <span className="w-24 text-xs ledger-mono" style={{ color: "var(--ink-soft)" }}>due day {t.dueDay}</span>
            <StampBadge label={t.status} tone={t.status === "PAID" ? "green" : t.status === "OVERDUE" ? "red" : "navy"} />
            <span className="flex-1" />
            {t.status !== "PAID" && (
              <button onClick={() => onEdit(t.id, { lastPaidPeriod: currentPeriod() })} className="text-xs font-semibold px-2 py-1 rounded-md transition hover:brightness-110" style={{ background: "var(--green)", color: "#fff" }}>Mark paid</button>
            )}
            <button onClick={() => openEdit(t)} className="p-1.5 rounded-md transition hover:bg-black/5" style={{ color: "var(--ink-soft)" }}><Pencil size={14} /></button>
            <button onClick={() => onDelete(t.id)} className="p-1.5 rounded-md transition hover:bg-red-50" style={{ color: "var(--red)" }}><Trash2 size={14} /></button>
          </div>
        ))}
        {tenants.length === 0 && <p className="text-sm py-6" style={{ color: "var(--ink-soft)" }}>No tenants on the ledger yet.</p>}
      </div>
    </div>
  );
}

function RepairsTab({ repairs, properties, onAdd, onEdit, onDelete, open, inProgress, done }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", propertyId: "", unit: "", priority: "Medium", status: "Open", notes: "" });
  const [photoCache, setPhotoCache] = useState({});
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    const allIds = repairs.flatMap((r) => r.photoIds || []);
    const missing = allIds.filter((id) => !(id in photoCache));
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(missing.map(async (id) => {
        try { const res = await storage.get(`photo:${id}`, false); return [id, res?.value || null]; }
        catch { return [id, null]; }
      }));
      setPhotoCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
  }, [repairs]);

  function openAdd() { setDraft({ title: "", propertyId: "", unit: "", priority: "Medium", status: "Open", notes: "" }); setEditingId(null); setShowForm(true); }
  function openEdit(r) { setDraft({ title: r.title, propertyId: r.propertyId || "", unit: r.unit, priority: r.priority, status: r.status, notes: r.notes }); setEditingId(r.id); setShowForm(true); }
  function save() {
    if (!draft.title) return;
    if (editingId) onEdit(editingId, draft);
    else onAdd({ ...draft, dateReported: new Date().toISOString().slice(0, 10), photoIds: [] });
    setShowForm(false);
  }

  async function handleAddPhoto(repairId, file) {
    if (!file) return;
    const dataUrl = await compressImage(file);
    const photoId = uid();
    try { await storage.set(`photo:${photoId}`, dataUrl, false); } catch {}
    setPhotoCache((prev) => ({ ...prev, [photoId]: dataUrl }));
    const repair = repairs.find((r) => r.id === repairId);
    onEdit(repairId, { photoIds: [...(repair.photoIds || []), photoId] });
  }
  async function handleDeletePhoto(repairId, photoId) {
    try { await storage.delete(`photo:${photoId}`, false); } catch {}
    const repair = repairs.find((r) => r.id === repairId);
    onEdit(repairId, { photoIds: (repair.photoIds || []).filter((id) => id !== photoId) });
    setPhotoCache((prev) => { const copy = { ...prev }; delete copy[photoId]; return copy; });
    setLightbox(null);
  }

  const priorityColor = { High: "var(--red)", Medium: "var(--kraft)", Low: "var(--green)" };
  const statusTone = { Open: "red", "In Progress": "navy", Done: "green" };

  return (
    <div>
      <div className="card p-4 mb-6 flex items-center gap-5">
        <RepairsDonut open={open} inProgress={inProgress} done={done} />
        <div className="ledger-mono text-xs space-y-1">
          <p><span style={{ color: "var(--chart-red)" }}>■</span> Open — {open}</p>
          <p><span style={{ color: "var(--chart-amber)" }}>■</span> In Progress — {inProgress}</p>
          <p><span style={{ color: "var(--chart-green)" }}>■</span> Done — {done}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="ledger-serif text-sm">Repair requests</p>
        <button onClick={openAdd} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-125" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          <Plus size={14} /> Add repair
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4 grid sm:grid-cols-2 gap-3">
          <LedgerInput label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <PropertySelect properties={properties} value={draft.propertyId} onChange={(e) => setDraft({ ...draft, propertyId: e.target.value })} />
          <LedgerInput label="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
            Priority
            <select className="ledger-input" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
              <option>Low</option><option>Medium</option><option>High</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
            Status
            <select className="ledger-input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option>Open</option><option>In Progress</option><option>Done</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2" style={{ color: "var(--ink-soft)" }}>
            Notes
            <input className="ledger-input" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button onClick={save} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-110" style={{ background: "var(--green)", color: "#fff" }}><Check size={14} /> Save</button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:bg-black/5" style={{ border: "1px solid var(--rule)" }}><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {repairs.map((r) => (
          <div key={r.id} className="card card-hover p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm">{r.title}</p>
              <span className="text-[10px] font-mono shrink-0" style={{ color: priorityColor[r.priority] }}>{r.priority?.toUpperCase()}</span>
            </div>
            <p className="text-xs ledger-mono mb-2" style={{ color: "var(--ink-soft)" }}>{propName(properties, r.propertyId)}{r.unit ? ` · ${r.unit}` : ""} · reported {formatDate(r.dateReported)}</p>
            {r.notes && <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>{r.notes}</p>}

            <div className="flex flex-wrap gap-1.5 mb-2">
              {(r.photoIds || []).map((id) => photoCache[id] ? (
                <button key={id} onClick={() => setLightbox({ repairId: r.id, photoId: id })} className="w-12 h-12 rounded-sm overflow-hidden" style={{ border: "1px solid var(--rule)" }}>
                  <img src={photoCache[id]} className="w-full h-full object-cover" alt="Repair" />
                </button>
              ) : (
                <div key={id} className="w-12 h-12 rounded-sm animate-pulse" style={{ background: "var(--rule)" }} />
              ))}
              <label className="w-12 h-12 rounded-sm border border-dashed flex items-center justify-center cursor-pointer" style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}>
                <Camera size={16} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { handleAddPhoto(r.id, e.target.files[0]); e.target.value = ""; }} />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <StampBadge label={r.status} tone={statusTone[r.status]} />
              <span className="flex-1" />
              <button onClick={() => openEdit(r)} className="p-1.5 rounded-md transition hover:bg-black/5" style={{ color: "var(--ink-soft)" }}><Pencil size={14} /></button>
              <button onClick={() => onDelete(r.id)} className="p-1.5 rounded-md transition hover:bg-red-50" style={{ color: "var(--red)" }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {repairs.length === 0 && <p className="text-sm py-6" style={{ color: "var(--ink-soft)" }}>No repairs logged yet.</p>}
      </div>

      {lightbox && photoCache[lightbox.photoId] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(30,42,47,0.85)" }} onClick={() => setLightbox(null)}>
          <div className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img src={photoCache[lightbox.photoId]} className="w-full rounded" alt="Repair full size" />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => handleDeletePhoto(lightbox.repairId, lightbox.photoId)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-110" style={{ background: "var(--red)", color: "#fff" }}><Trash2 size={14} /> Delete photo</button>
              <button onClick={() => setLightbox(null)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:bg-white/10" style={{ border: "1px solid var(--paper)", color: "var(--paper)" }}><X size={14} /> Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComplaintsTab({ complaints, properties, onAdd, onEdit, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", propertyId: "", unit: "", filedBy: "", category: "Noise", status: "Open", notes: "" });

  function openAdd() { setDraft({ title: "", propertyId: "", unit: "", filedBy: "", category: "Noise", status: "Open", notes: "" }); setEditingId(null); setShowForm(true); }
  function openEdit(c) { setDraft({ title: c.title, propertyId: c.propertyId || "", unit: c.unit, filedBy: c.filedBy, category: c.category, status: c.status, notes: c.notes }); setEditingId(c.id); setShowForm(true); }
  function save() {
    if (!draft.title) return;
    if (editingId) onEdit(editingId, draft);
    else onAdd({ ...draft, dateReported: new Date().toISOString().slice(0, 10) });
    setShowForm(false);
  }

  const categoryColor = { Noise: "var(--kraft)", Parking: "var(--ink)", "Neighbor Dispute": "var(--red)", Other: "var(--green)" };
  const statusTone = { Open: "red", Reviewing: "navy", Resolved: "green" };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="ledger-serif text-sm">Complaints</p>
        <button onClick={openAdd} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-125" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          <Plus size={14} /> Log complaint
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4 grid sm:grid-cols-2 gap-3">
          <LedgerInput label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <LedgerInput label="Filed by" value={draft.filedBy} onChange={(e) => setDraft({ ...draft, filedBy: e.target.value })} />
          <PropertySelect properties={properties} value={draft.propertyId} onChange={(e) => setDraft({ ...draft, propertyId: e.target.value })} />
          <LedgerInput label="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
            Category
            <select className="ledger-input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <option>Noise</option><option>Parking</option><option>Neighbor Dispute</option><option>Other</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
            Status
            <select className="ledger-input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option>Open</option><option>Reviewing</option><option>Resolved</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2" style={{ color: "var(--ink-soft)" }}>
            Notes
            <input className="ledger-input" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button onClick={save} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-110" style={{ background: "var(--green)", color: "#fff" }}><Check size={14} /> Save</button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:bg-black/5" style={{ border: "1px solid var(--rule)" }}><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {complaints.map((c) => (
          <div key={c.id} className="card card-hover p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm">{c.title}</p>
              <span className="text-[10px] font-mono shrink-0" style={{ color: categoryColor[c.category] || "var(--ink-soft)" }}>{c.category?.toUpperCase()}</span>
            </div>
            <p className="text-xs ledger-mono mb-2" style={{ color: "var(--ink-soft)" }}>{propName(properties, c.propertyId)}{c.unit ? ` · ${c.unit}` : ""} · filed by {c.filedBy || "—"} · {formatDate(c.dateReported)}</p>
            {c.notes && <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>{c.notes}</p>}
            <div className="flex items-center gap-2">
              <StampBadge label={c.status} tone={statusTone[c.status]} />
              <span className="flex-1" />
              <button onClick={() => openEdit(c)} className="p-1.5 rounded-md transition hover:bg-black/5" style={{ color: "var(--ink-soft)" }}><Pencil size={14} /></button>
              <button onClick={() => onDelete(c.id)} className="p-1.5 rounded-md transition hover:bg-red-50" style={{ color: "var(--red)" }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {complaints.length === 0 && <p className="text-sm py-6" style={{ color: "var(--ink-soft)" }}>No complaints logged.</p>}
      </div>
    </div>
  );
}

function AppointmentsTab({ appointments, properties, onAdd, onEdit, onDelete }) {
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", person: "", propertyId: "", unit: "", date: selectedDate, time: "", notes: "" });

  const appointmentsByDate = useMemo(() => {
    const map = {};
    for (const a of appointments) { (map[a.date] = map[a.date] || []).push(a); }
    return map;
  }, [appointments]);

  const upcoming = useMemo(() => [...appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [appointments]);

  function openAdd(dateStr) { setDraft({ title: "", person: "", propertyId: "", unit: "", date: dateStr || selectedDate, time: "", notes: "" }); setEditingId(null); setShowForm(true); }
  function openEdit(a) { setDraft({ title: a.title, person: a.person, propertyId: a.propertyId || "", unit: a.unit, date: a.date, time: a.time, notes: a.notes }); setEditingId(a.id); setShowForm(true); }
  function save() {
    if (!draft.title || !draft.date) return;
    if (editingId) onEdit(editingId, draft);
    else onAdd(draft);
    setShowForm(false);
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-6">
      <div className="card p-4">
        <AppointmentCalendar
          cursor={cursor} setCursor={setCursor}
          appointmentsByDate={appointmentsByDate}
          selectedDate={selectedDate}
          onSelectDay={(d) => { setSelectedDate(d); openAdd(d); }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="ledger-serif text-sm">Upcoming appointments</p>
          <button onClick={() => openAdd(selectedDate)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-125" style={{ background: "var(--ink)", color: "var(--paper)" }}>
            <Plus size={14} /> Schedule
          </button>
        </div>

        {showForm && (
          <div className="card p-4 mb-4 grid sm:grid-cols-2 gap-3">
            <LedgerInput label="Title / reason" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <LedgerInput label="Person" value={draft.person} onChange={(e) => setDraft({ ...draft, person: e.target.value })} />
            <PropertySelect properties={properties} value={draft.propertyId} onChange={(e) => setDraft({ ...draft, propertyId: e.target.value })} />
            <LedgerInput label="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            <LedgerInput label="Date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            <LedgerInput label="Time" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
            <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2" style={{ color: "var(--ink-soft)" }}>
              Notes
              <input className="ledger-input" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </label>
            <div className="sm:col-span-2 flex gap-2">
              <button onClick={save} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:brightness-110" style={{ background: "var(--green)", color: "#fff" }}><Check size={14} /> Save</button>
              <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md transition hover:bg-black/5" style={{ border: "1px solid var(--rule)" }}><X size={14} /> Cancel</button>
            </div>
          </div>
        )}

        <div className="ledger-lines">
          {upcoming.map((a) => (
            <div key={a.id} className="ledger-row flex flex-wrap items-center gap-3 py-2.5 px-2 -mx-2">
              <span className="w-24 ledger-mono text-xs" style={{ color: "var(--ink-soft)" }}>{formatDate(a.date)}</span>
              <span className="w-14 ledger-mono text-xs" style={{ color: "var(--ink-soft)" }}>{a.time}</span>
              <span className="font-medium text-sm">{a.title}</span>
              <span className="text-xs ledger-mono" style={{ color: "var(--ink-soft)" }}>{a.person}{a.propertyId ? ` · ${propName(properties, a.propertyId)}` : ""}{a.unit ? ` · ${a.unit}` : ""}</span>
              <span className="flex-1" />
              <button onClick={() => openEdit(a)} className="p-1.5 rounded-md transition hover:bg-black/5" style={{ color: "var(--ink-soft)" }}><Pencil size={14} /></button>
              <button onClick={() => onDelete(a.id)} className="p-1.5 rounded-md transition hover:bg-red-50" style={{ color: "var(--red)" }}><Trash2 size={14} /></button>
            </div>
          ))}
          {upcoming.length === 0 && <p className="text-sm py-6" style={{ color: "var(--ink-soft)" }}>Nothing scheduled yet.</p>}
        </div>
      </div>
    </div>
  );
}