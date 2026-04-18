"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/lib/SessionContext";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SHAREABLE_FIELD_LABELS: Record<string, string> = {
  full_name: "Full Name",
  biz_category: "Business Category",
  one_line_summary: "One-Line Summary",
  intro_text: "Introduction Text",
  whatsapp: "WhatsApp Number",
  office_address: "Office Address",
};

type Tab = "meeting" | "engine" | "fields";

interface RsvpReminder {
  offset_day: number;
  time: string;
}

export default function SettingsPage() {
  const api = useApi();
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>("meeting");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const LT_ROLES_CHECK = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];
  const hasAccess = session && LT_ROLES_CHECK.includes(session.role);
  const isAdmin = session?.role === "ADMIN";
  const canEdit = session?.role === "ADMIN" || session?.role === "PRESIDENT";

  // Meeting settings — hooks must be called unconditionally (React rules)
  const [meeting, setMeeting] = useState({
    meeting_day: 4,
    meeting_start_time: "07:00:00",
    meeting_duration_mins: 90,
    quiet_start: "21:00",
    quiet_end: "07:00",
    rsvp_reminder_schedule: [] as RsvpReminder[],
  });

  // Engine settings
  const [engine, setEngine] = useState({
    lookback_days: 180,
    cooldown_days: 60,
    max_recs_per_cycle: 3,
    post_meeting_delay_mins: 120,
    rec_expiry_days: 30,
  });

  // Shareable fields
  const [fields, setFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!session) return;
    const chId = session.chapterId;

    const fetches: Promise<unknown>[] = [
      api.get(`/chapters/${chId}/settings`),
    ];
    // Shareable fields API is ADMIN only
    if (session.role === "ADMIN") {
      fetches.push(api.get(`/chapters/${chId}/shareable-fields`));
    }

    Promise.all(fetches).then((results) => {
      const settingsRes = results[0] as { data: { data: Record<string, unknown> } };
      const s = settingsRes.data.data;
      setMeeting({
        meeting_day: s.meeting_day as number,
        meeting_start_time: s.meeting_start_time as string,
        meeting_duration_mins: s.meeting_duration_mins as number,
        quiet_start: s.quiet_start as string,
        quiet_end: s.quiet_end as string,
        rsvp_reminder_schedule: (s.rsvp_reminder_schedule as RsvpReminder[]) ?? [],
      });
      setEngine({
        lookback_days: s.lookback_days as number,
        cooldown_days: s.cooldown_days as number,
        max_recs_per_cycle: s.max_recs_per_cycle as number,
        post_meeting_delay_mins: s.post_meeting_delay_mins as number,
        rec_expiry_days: s.rec_expiry_days as number,
      });
      if (results[1]) {
        const fieldsRes = results[1] as { data: { data: { field_name: string; is_shareable: boolean }[] } };
        const fieldMap: Record<string, boolean> = {};
        for (const f of fieldsRes.data.data) {
          fieldMap[f.field_name] = f.is_shareable;
        }
        setFields(fieldMap);
      }
      setLoading(false);
    }).catch(() => {
      showToast("error", "Failed to load settings");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function saveMeeting() {
    if (!session) return;
    setSaving(true);
    try {
      await api.patch(`/chapters/${session.chapterId}/settings`, meeting);
      showToast("success", "Meeting settings saved");
    } catch {
      showToast("error", "Failed to save meeting settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveEngine() {
    if (!session) return;
    setSaving(true);
    try {
      await api.patch(`/chapters/${session.chapterId}/settings`, engine);
      showToast("success", "Engine settings saved");
    } catch {
      showToast("error", "Failed to save engine settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveFields() {
    if (!session) return;
    setSaving(true);
    try {
      const updates = Object.entries(fields).map(([field_name, is_shareable]) => ({
        field_name,
        is_shareable,
      }));
      await api.patch(`/chapters/${session.chapterId}/shareable-fields`, { updates });
      showToast("success", "Shareable fields saved");
    } catch {
      showToast("error", "Failed to save shareable fields");
    } finally {
      setSaving(false);
    }
  }

  function addRsvpReminder() {
    setMeeting((prev) => ({
      ...prev,
      rsvp_reminder_schedule: [
        ...prev.rsvp_reminder_schedule,
        { offset_day: 0, time: "08:00" },
      ],
    }));
  }

  function removeRsvpReminder(index: number) {
    setMeeting((prev) => ({
      ...prev,
      rsvp_reminder_schedule: prev.rsvp_reminder_schedule.filter((_, i) => i !== index),
    }));
  }

  function updateRsvpReminder(index: number, key: "offset_day" | "time", value: string | number) {
    setMeeting((prev) => ({
      ...prev,
      rsvp_reminder_schedule: prev.rsvp_reminder_schedule.map((r, i) =>
        i === index ? { ...r, [key]: value } : r
      ),
    }));
  }

  // Build WhatsApp message preview
  const previewLines: string[] = [];
  if (fields.full_name) previewLines.push("*Rakesh Patel*");
  if (fields.biz_category) previewLines.push("Financial Services");
  if (fields.one_line_summary) previewLines.push("Helping families secure their financial future");
  if (fields.intro_text) previewLines.push("_Specialising in term & health insurance..._");
  if (fields.whatsapp) previewLines.push("WhatsApp: +91 98765 43210");
  if (fields.office_address) previewLines.push("Office: Satellite, Ahmedabad");

  // Access check — placed after all hooks to satisfy React rules
  if (session && !hasAccess) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-navy mb-2">Access Denied</h1>
        <p className="text-gray-500">Only Leadership Team members can access Chapter Settings.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-headline text-navy">Chapter Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure meeting schedule, engine rules, and message preferences
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium animate-slide-up ${
            toast.type === "success"
              ? "bg-bni-green-50 text-bni-green-600 ring-1 ring-bni-green-100"
              : "bg-bni-red-50 text-bni-red-600 ring-1 ring-bni-red-100"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        {(
          [
            ["meeting", "Meeting & Comms"],
            ["engine", "1-2-1 Engine"],
            ...(isAdmin ? [["fields", "Shareable Fields"]] : []),
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-full transition-all duration-normal whitespace-nowrap border ${
              tab === key
                ? "bg-navy text-white border-navy shadow-soft"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab 1: Meeting */}
      {tab === "meeting" && (
        <div className="card space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Day</label>
              <select
                value={meeting.meeting_day}
                onChange={(e) => setMeeting((p) => ({ ...p, meeting_day: Number(e.target.value) }))}
                className="input-field"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={meeting.meeting_start_time.slice(0, 5)}
                onChange={(e) =>
                  setMeeting((p) => ({ ...p, meeting_start_time: e.target.value + ":00" }))
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={meeting.meeting_duration_mins}
                onChange={(e) =>
                  setMeeting((p) => ({ ...p, meeting_duration_mins: Number(e.target.value) }))
                }
                className="input-field"
                min={30}
                max={240}
              />
            </div>
          </div>

          {/* Quiet Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quiet Hours (no messages sent)</label>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={meeting.quiet_start}
                onChange={(e) => setMeeting((p) => ({ ...p, quiet_start: e.target.value }))}
                className="input-field w-auto"
              />
              <span className="text-gray-400">to</span>
              <input
                type="time"
                value={meeting.quiet_end}
                onChange={(e) => setMeeting((p) => ({ ...p, quiet_end: e.target.value }))}
                className="input-field w-auto"
              />
            </div>
          </div>

          {/* RSVP Reminders */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">RSVP Reminder Schedule</label>
            <div className="space-y-2">
              {meeting.rsvp_reminder_schedule.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <select
                    value={r.offset_day}
                    onChange={(e) => updateRsvpReminder(i, "offset_day", Number(e.target.value))}
                    className="input-field w-auto"
                  >
                    <option value={-2}>2 days before</option>
                    <option value={-1}>1 day before</option>
                    <option value={0}>Same day</option>
                  </select>
                  <input
                    type="time"
                    value={r.time}
                    onChange={(e) => updateRsvpReminder(i, "time", e.target.value)}
                    className="input-field w-auto"
                  />
                  <button
                    onClick={() => removeRsvpReminder(i)}
                    className="text-bni-red text-sm hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addRsvpReminder} className="text-bni-blue text-sm mt-2 hover:underline">
              + Add Reminder
            </button>
          </div>

          {canEdit && (
            <button onClick={saveMeeting} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? "Saving..." : "Save Meeting Settings"}
            </button>
          )}
        </div>
      )}

      {/* Tab 2: Engine */}
      {tab === "engine" && (
        <div className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lookback Window: {engine.lookback_days} days
            </label>
            <input
              type="range"
              min={30}
              max={365}
              value={engine.lookback_days}
              onChange={(e) => setEngine((p) => ({ ...p, lookback_days: Number(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>30 days</span><span>365 days</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recommendation Cooldown: {engine.cooldown_days} days
            </label>
            <input
              type="range"
              min={14}
              max={90}
              value={engine.cooldown_days}
              onChange={(e) => setEngine((p) => ({ ...p, cooldown_days: Number(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>14 days</span><span>90 days</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Recommendations per Cycle
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={engine.max_recs_per_cycle}
              onChange={(e) => setEngine((p) => ({ ...p, max_recs_per_cycle: Number(e.target.value) }))}
              className="input-field w-32"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post-Meeting Trigger Delay (minutes)
            </label>
            <input
              type="number"
              min={0}
              max={480}
              value={engine.post_meeting_delay_mins}
              onChange={(e) =>
                setEngine((p) => ({ ...p, post_meeting_delay_mins: Number(e.target.value) }))
              }
              className="input-field w-32"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recommendation Expiry (days)
            </label>
            <input
              type="number"
              min={7}
              max={90}
              value={engine.rec_expiry_days}
              onChange={(e) => setEngine((p) => ({ ...p, rec_expiry_days: Number(e.target.value) }))}
              className="input-field w-32"
            />
          </div>

          {canEdit && (
            <button onClick={saveEngine} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? "Saving..." : "Save Engine Settings"}
            </button>
          )}
        </div>
      )}

      {/* Tab 3: Shareable Fields */}
      {tab === "fields" && (
        <div className="card space-y-5">
          <div className="bg-bni-amber/10 border border-bni-amber/20 rounded-lg px-4 py-3 text-sm text-bni-amber">
            These fields will be included in WhatsApp introduction messages sent to members.
          </div>

          <div className="space-y-3">
            {Object.entries(SHAREABLE_FIELD_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">{label}</span>
                <div
                  className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${
                    fields[key] ? "bg-bni-green" : "bg-gray-300"
                  }`}
                  onClick={() => setFields((prev) => ({ ...prev, [key]: !prev[key] }))}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      fields[key] ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp Preview */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Message Preview</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm font-mono whitespace-pre-line">
              {previewLines.length > 0
                ? `Hi! Meet your fellow BNI member:\n\n${previewLines.join("\n")}\n\nConnect for a 1-2-1 this week!`
                : "No fields selected — message will be empty."}
            </div>
          </div>

          <button onClick={saveFields} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? "Saving..." : "Save Field Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
