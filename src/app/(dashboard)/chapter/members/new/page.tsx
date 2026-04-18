"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/lib/SessionContext";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";

const ROLES = [
  { value: "MEMBER", label: "Member" },
  { value: "PRESIDENT", label: "President" },
  { value: "VP", label: "VP" },
  { value: "SECRETARY", label: "Secretary" },
  { value: "TREASURER", label: "Treasurer" },
  { value: "ADMIN", label: "Admin" },
];

export default function NewMemberPage() {
  const router = useRouter();
  const api = useApi();
  const { session } = useSession();

  const [form, setForm] = useState({
    full_name: "",
    countryCode: "+91",
    mobileNumber: "",
    whatsappNumber: "",
    sameAsMobile: true,
    email: "",
    biz_category: "",
    one_line_summary: "",
    intro_text: "",
    office_address: "",
    chapter_role: "MEMBER",
    joining_date: new Date().toISOString().split("T")[0],
    comm_eligible: true,
    rec_active: true,
  });

  const [mapPreview, setMapPreview] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handlePlaceSelect = useCallback(
    (result: { formatted_address: string; lat: number; lng: number }) => {
      setForm((prev) => ({ ...prev, office_address: result.formatted_address }));
      setMapPreview({ lat: result.lat, lng: result.lng });
    },
    []
  );

  const addressRef = usePlacesAutocomplete(handlePlaceSelect);

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.full_name.trim()) errs.full_name = "Full name is required";
    if (!form.mobileNumber.trim() || form.mobileNumber.length < 10)
      errs.mobile = "Valid mobile number is required";
    if (
      !form.sameAsMobile &&
      (!form.whatsappNumber.trim() || form.whatsappNumber.length < 10)
    )
      errs.whatsapp = "Valid WhatsApp number is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Valid email is required";
    if (!form.biz_category.trim()) errs.biz_category = "Business category is required";
    if (form.one_line_summary.length < 10)
      errs.one_line_summary = "Summary must be at least 10 characters";
    if (form.one_line_summary.length > 250)
      errs.one_line_summary = "Summary must be 250 characters or less";
    if (form.intro_text.length > 400)
      errs.intro_text = "Introduction must be 400 characters or less";
    if (!form.office_address.trim() || form.office_address.length < 10)
      errs.office_address = "Office address is required (use autocomplete)";
    if (!form.joining_date) errs.joining_date = "Joining date is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Sync address from DOM (Google Autocomplete sets it directly)
    if (addressRef.current) {
      const domAddress = addressRef.current.value;
      if (domAddress && domAddress !== form.office_address) {
        setForm((prev) => ({ ...prev, office_address: domAddress }));
        form.office_address = domAddress;
      }
    }

    if (!validate()) return;
    if (!session) return;

    const mobile = `${form.countryCode}${form.mobileNumber}`;
    const whatsapp = form.sameAsMobile
      ? mobile
      : `${form.countryCode}${form.whatsappNumber}`;

    setLoading(true);
    setErrors({});

    try {
      const res = await api.post(
        `/chapters/${session.chapterId}/members`,
        {
          full_name: form.full_name.trim(),
          mobile,
          whatsapp,
          email: form.email.trim(),
          biz_category: form.biz_category.trim(),
          one_line_summary: form.one_line_summary.trim(),
          intro_text: form.intro_text.trim() || undefined,
          office_address: form.office_address.trim(),
          chapter_role: form.chapter_role,
          joining_date: new Date(form.joining_date).toISOString(),
        }
      );

      setSuccess("Member created successfully!");
      setTimeout(() => {
        router.push(`/chapter/members/${res.data.data.member_id}`);
      }, 500);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { code?: string; fields?: Record<string, string> } } };
      };
      const apiFields = axiosErr.response?.data?.error?.fields;
      if (apiFields) {
        setErrors(apiFields);
      } else {
        const code = axiosErr.response?.data?.error?.code;
        if (code === "MEMBER_DUPLICATE_MOBILE") {
          setErrors({ mobile: "A member with this mobile number already exists" });
        } else if (code === "MEMBER_DUPLICATE_WHATSAPP") {
          setErrors({ whatsapp: "A member with this WhatsApp number already exists" });
        } else if (code === "MEMBER_DUPLICATE_EMAIL") {
          setErrors({ email: "A member with this email already exists" });
        } else {
          setErrors({ _form: "Something went wrong. Please try again." });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-headline text-navy">Add New Member</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create a new chapter member profile
        </p>
      </div>

      {success && (
        <div className="rounded-lg bg-bni-green-50 text-bni-green-600 ring-1 ring-bni-green-100 px-4 py-3 text-sm font-medium animate-slide-up">
          {success}
        </div>
      )}

      {errors._form && (
        <div className="rounded-lg bg-bni-red-50 text-bni-red-600 ring-1 ring-bni-red-100 px-4 py-3 text-sm font-medium animate-slide-up">
          {errors._form}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-soft border border-slate-100 p-5 lg:p-6 space-y-6">
        <SectionHeader
          title="Personal Information"
          description="Name and contact details"
        />

        {/* Full Name */}
        <Field label="Full Name" error={errors.full_name} required>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            className="input-field"
            placeholder="e.g. Rakesh Patel"
          />
        </Field>

        {/* Mobile Number */}
        <Field label="Mobile Number" error={errors.mobile} required>
          <div className="flex gap-2">
            <select
              value={form.countryCode}
              onChange={(e) => updateField("countryCode", e.target.value)}
              className="input-field w-24"
            >
              <option value="+91">+91</option>
              <option value="+1">+1</option>
              <option value="+44">+44</option>
              <option value="+971">+971</option>
            </select>
            <input
              type="tel"
              value={form.mobileNumber}
              onChange={(e) =>
                updateField(
                  "mobileNumber",
                  e.target.value.replace(/\D/g, "").slice(0, 10)
                )
              }
              className="input-field flex-1"
              placeholder="9876543210"
            />
          </div>
        </Field>

        {/* WhatsApp Number */}
        <Field label="WhatsApp Number" error={errors.whatsapp} required>
          <label className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <input
              type="checkbox"
              checked={form.sameAsMobile}
              onChange={(e) => updateField("sameAsMobile", e.target.checked)}
              className="rounded"
            />
            Same as mobile
          </label>
          {!form.sameAsMobile && (
            <div className="flex gap-2">
              <select
                value={form.countryCode}
                disabled
                className="input-field w-24 bg-gray-50"
              >
                <option value="+91">+91</option>
              </select>
              <input
                type="tel"
                value={form.whatsappNumber}
                onChange={(e) =>
                  updateField(
                    "whatsappNumber",
                    e.target.value.replace(/\D/g, "").slice(0, 10)
                  )
                }
                className="input-field flex-1"
                placeholder="9876543210"
              />
            </div>
          )}
        </Field>

        {/* Email */}
        <Field label="Email" error={errors.email} required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            className="input-field"
            placeholder="member@example.com"
          />
          <p className="text-xs text-gray-400 mt-1">
            Used for login access to BNI Connect
          </p>
        </Field>

        <div className="border-t border-slate-100 pt-5">
          <SectionHeader
            title="Business Details"
            description="Category and description for 1-2-1 introductions"
          />
        </div>

        {/* Business Category */}
        <Field label="Business Category" error={errors.biz_category} required>
          <input
            type="text"
            value={form.biz_category}
            onChange={(e) => updateField("biz_category", e.target.value)}
            className="input-field"
            placeholder="e.g. Financial Services"
          />
        </Field>

        {/* One-Line Summary */}
        <Field label="One-Line Business Summary" error={errors.one_line_summary} required>
          <input
            type="text"
            value={form.one_line_summary}
            onChange={(e) => updateField("one_line_summary", e.target.value)}
            className="input-field"
            maxLength={250}
            placeholder="e.g. Helping families secure their financial future through insurance"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">
            {form.one_line_summary.length}/250
          </p>
        </Field>

        {/* Introduction Text */}
        <Field label="Introduction Text" error={errors.intro_text}>
          <textarea
            value={form.intro_text}
            onChange={(e) => updateField("intro_text", e.target.value)}
            className="input-field min-h-[80px]"
            maxLength={400}
            placeholder="Custom text for WhatsApp recommendation messages (optional)"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">
            {form.intro_text.length}/400
          </p>
          <p className="text-xs text-gray-400">
            Override for WhatsApp messages
          </p>
        </Field>

        <div className="border-t border-slate-100 pt-5">
          <SectionHeader
            title="Office Location"
            description="Used for map pins and WhatsApp intro messages"
          />
        </div>

        {/* Office Address */}
        <Field label="Office Address" error={errors.office_address} required>
          <input
            ref={addressRef}
            type="text"
            defaultValue={form.office_address}
            onChange={(e) => updateField("office_address", e.target.value)}
            className="input-field"
            placeholder="Start typing to search..."
          />
          {mapPreview && mapsKey && (
            <Image
              src={`https://maps.googleapis.com/maps/api/staticmap?center=${mapPreview.lat},${mapPreview.lng}&zoom=15&size=400x150&markers=color:blue|${mapPreview.lat},${mapPreview.lng}&key=${mapsKey}`}
              alt="Location preview"
              width={400}
              height={150}
              className="mt-2 rounded-lg w-full h-[150px] object-cover"
              unoptimized
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          {mapPreview && (
            <p className="text-xs text-gray-500 mt-1">
              📍 {mapPreview.lat.toFixed(4)}, {mapPreview.lng.toFixed(4)}
            </p>
          )}
        </Field>

        <div className="border-t border-slate-100 pt-5">
          <SectionHeader
            title="Chapter Settings"
            description="Role and eligibility flags"
          />
        </div>

        {/* Chapter Role */}
        <Field label="Chapter Role" error={errors.chapter_role} required>
          <select
            value={form.chapter_role}
            onChange={(e) => updateField("chapter_role", e.target.value)}
            className="input-field"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        {/* Joining Date */}
        <Field label="Joining Date" error={errors.joining_date} required>
          <input
            type="date"
            value={form.joining_date}
            onChange={(e) => updateField("joining_date", e.target.value)}
            className="input-field"
          />
        </Field>

        {/* Toggles */}
        <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
          <ToggleRow
            label="Communication Eligible"
            description="Receive WhatsApp 1-2-1 introductions"
            checked={form.comm_eligible}
            onChange={(v) => updateField("comm_eligible", v)}
          />
          <ToggleRow
            label="Recommendation Active"
            description="Include in automated pairing cycles"
            checked={form.rec_active}
            onChange={(v) => updateField("rec_active", v)}
          />
        </div>

        {/* Submit */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 bg-white text-navy border border-slate-300 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-slate-50 transition-colors order-2 sm:order-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-navy text-white rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-navy-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-soft transition-colors order-1 sm:order-2"
          >
            {loading ? "Creating..." : "Create Member"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* Section header for grouped form fields */
function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-subtitle text-navy">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
  );
}

/* Accessible toggle switch */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-navy">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          flex-shrink-0 w-11 h-6 rounded-full relative transition-colors duration-normal
          ${checked ? "bg-bni-green-500" : "bg-slate-300"}
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-normal
            ${checked ? "translate-x-5" : "translate-x-0"}
          `}
          aria-hidden="true"
        />
      </button>
    </label>
  );
}

/* Reusable field wrapper */
function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-caption font-semibold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-bni-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-bni-red-600 text-xs mt-1.5 font-medium">{error}</p>
      )}
    </div>
  );
}
