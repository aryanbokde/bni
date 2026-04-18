"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useAccessToken } from "@/lib/TokenProvider";

interface Props {
  memberId: string;
}

export default function ChangePasswordForm({ memberId }: Props) {
  const api = useApi();
  const accessToken = useAccessToken();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one letter and one number");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/set-password", {
        memberId,
        newPassword,
      });
      setSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { code?: string; fields?: Record<string, string> } } } };
      const code = axiosErr.response?.data?.error?.code;
      if (code === "WEAK_PASSWORD") {
        setError(
          axiosErr.response?.data?.error?.fields?.password ??
            "Password is too weak"
        );
      } else {
        setError("Failed to change password. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!accessToken) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-semibold text-lg">Change Password</h3>

      <input
        type="password"
        placeholder="Current Password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2"
      />
      <input
        type="password"
        placeholder="New Password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2"
      />
      <input
        type="password"
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2"
      />

      {error && <p className="text-bni-red text-sm">{error}</p>}
      {success && <p className="text-bni-green text-sm">{success}</p>}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary disabled:opacity-50"
      >
        {loading ? "Changing..." : "Change Password"}
      </button>
    </form>
  );
}
