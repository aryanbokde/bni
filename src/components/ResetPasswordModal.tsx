"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";

interface Props {
  memberId: string;
  memberName: string;
  onClose: () => void;
}

export default function ResetPasswordModal({
  memberId,
  memberName,
  onClose,
}: Props) {
  const api = useApi();
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (tempPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/set-password", {
        memberId,
        newPassword: tempPassword,
      });
      setSuccess(
        `Temp password set. Share it with ${memberName} securely.`
      );
      setTempPassword("");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { fields?: Record<string, string> } } } };
      setError(
        axiosErr.response?.data?.error?.fields?.password ??
          "Failed to reset password"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="card w-full max-w-sm">
        <h3 className="font-semibold text-lg mb-4">
          Reset Password for {memberName}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Enter temporary password"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            autoComplete="off"
          />

          {error && <p className="text-bni-red text-sm">{error}</p>}
          {success && <p className="text-bni-green text-sm">{success}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {loading ? "Setting..." : "Set Password"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
