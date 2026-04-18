"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/lib/SessionContext";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";
import type { MemberDecrypted } from "@/types/member";

const ROLES = [
  { value: "MEMBER", label: "Member" },
  { value: "PRESIDENT", label: "President" },
  { value: "VP", label: "VP" },
  { value: "SECRETARY", label: "Secretary" },
  { value: "TREASURER", label: "Treasurer" },
  { value: "ADMIN", label: "Admin" },
];

interface Props {
  member: MemberDecrypted;
  onClose: () => void;
}

export default function MemberEditDrawer({ member, onClose }: Props) {
  const api = useApi();
  const router = useRouter();
  const { session } = useSession();

  const [form, setForm] = useState({
    full_name: member.full_name,
    mobile: member.mobile,
    whatsapp: member.whatsapp,
    email: member.email,
    biz_category: member.biz_category,
    one_line_summary: member.one_line_summary,
    intro_text: member.intro_text ?? "",
    office_address: member.office_address,
    chapter_role: member.chapter_role,
    joining_date: new Date(member.joining_date).toISOString().split("T")[0],
    comm_eligible: member.comm_eligible,
    rec_active: member.rec_active,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handlePlaceSelect = useCallback(
    (result: { formatted_address: string }) => {
      setForm((prev) => ({ ...prev, office_address: result.formatted_address }));
    },
    []
  );

  const addressRef = usePlacesAutocomplete(handlePlaceSelect);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;

    setLoading(true);
    setErrors({});

    try {
      const payload: Record<string, unknown> = {
          full_name: form.full_name,
          mobile: form.mobile,
          whatsapp: form.whatsapp,
          email: form.email,
          biz_category: form.biz_category,
          one_line_summary: form.one_line_summary,
          intro_text: form.intro_text || undefined,
          office_address: form.office_address,
          chapter_role: form.chapter_role,
      };
      if (session.role === "ADMIN") {
        payload.joining_date = new Date(form.joining_date).toISOString();
        payload.comm_eligible = form.comm_eligible;
        payload.rec_active = form.rec_active;
      }
      await api.patch(
        `/chapters/${session.chapterId}/members/${member.member_id}`,
        payload
      );

      router.refresh();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { fields?: Record<string, string>; code?: string } } };
      };
      setErrors(
        axiosErr.response?.data?.error?.fields ?? {
          _form: axiosErr.response?.data?.error?.code ?? "Update failed",
        }
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white z-50 shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-navy">Edit Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errors._form && (
            <p className="text-bni-red text-sm">{errors._form}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} className="input-field" />
            {errors.full_name && <p className="text-bni-red text-xs mt-1">{errors.full_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
            <input type="tel" value={form.mobile} onChange={(e) => updateField("mobile", e.target.value)} className="input-field" />
            {errors.mobile && <p className="text-bni-red text-xs mt-1">{errors.mobile}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input type="tel" value={form.whatsapp} onChange={(e) => updateField("whatsapp", e.target.value)} className="input-field" />
            {errors.whatsapp && <p className="text-bni-red text-xs mt-1">{errors.whatsapp}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className="input-field" />
            {errors.email && <p className="text-bni-red text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Category</label>
            <input type="text" value={form.biz_category} onChange={(e) => updateField("biz_category", e.target.value)} className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">One-Line Summary</label>
            <input type="text" value={form.one_line_summary} onChange={(e) => updateField("one_line_summary", e.target.value)} className="input-field" maxLength={250} />
            <p className="text-xs text-gray-400 mt-1 text-right">{form.one_line_summary.length}/250</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Introduction Text</label>
            <textarea value={form.intro_text} onChange={(e) => updateField("intro_text", e.target.value)} className="input-field min-h-[80px]" maxLength={400} />
            <p className="text-xs text-gray-400 mt-1 text-right">{form.intro_text.length}/400</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Office Address</label>
            <input ref={addressRef} type="text" value={form.office_address} onChange={(e) => updateField("office_address", e.target.value)} className="input-field" />
          </div>

          {session?.role === "ADMIN" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chapter Role</label>
              <select value={form.chapter_role} onChange={(e) => updateField("chapter_role", e.target.value)} className="input-field">
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          {session?.role === "ADMIN" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
              <input type="date" value={form.joining_date} onChange={(e) => updateField("joining_date", e.target.value)} className="input-field" />
            </div>
          )}

          {session?.role === "ADMIN" && (
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-10 h-6 rounded-full relative transition-colors ${
                    form.comm_eligible ? "bg-bni-green" : "bg-gray-300"
                  }`}
                  onClick={() => setForm((prev) => ({ ...prev, comm_eligible: !prev.comm_eligible }))}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.comm_eligible ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
                <span className="text-sm">Communication Eligible</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-10 h-6 rounded-full relative transition-colors ${
                    form.rec_active ? "bg-bni-green" : "bg-gray-300"
                  }`}
                  onClick={() => setForm((prev) => ({ ...prev, rec_active: !prev.rec_active }))}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.rec_active ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
                <span className="text-sm">Recommendation Active</span>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
