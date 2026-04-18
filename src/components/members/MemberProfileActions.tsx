"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/lib/SessionContext";
import MemberEditDrawer from "@/components/members/MemberEditDrawer";
import ResetPasswordModal from "@/components/ResetPasswordModal";
import type { MemberDecrypted } from "@/types/member";

interface Props {
  member: MemberDecrypted;
}

export default function MemberProfileActions({ member }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useSession();

  const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];
  const isAdmin = session?.role === "ADMIN";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isLT = LT_ROLES.includes(session?.role ?? "");
  const isSelf = session?.memberId === member.member_id;

  const canEdit = isAdmin || isSelf;
  const processedRef = useRef(false);

  // Auto-open edit drawer / archive modal from URL params — ONCE on mount only
  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const editParam = searchParams.get("edit");
    const archiveParam = searchParams.get("archive");
    if (editParam === "true" && canEdit) {
      setEditOpen(true);
    }
    if (archiveParam === "true" && isAdmin && member.status !== "ARCHIVED") {
      setArchiveOpen(true);
    }
  }, [searchParams, canEdit, isAdmin, member.status]);

  // Strip ?edit=true / ?archive=true when closing so reload doesn't re-open
  function closeEdit() {
    setEditOpen(false);
    if (searchParams.get("edit")) {
      router.replace(pathname);
    }
  }

  function closeArchive() {
    setArchiveOpen(false);
    setReason("");
    if (searchParams.get("archive")) {
      router.replace(pathname);
    }
  }

  async function handleArchive() {
    if (!session || !reason.trim()) return;
    setLoading(true);
    try {
      await api.post(
        `/chapters/${session.chapterId}/members/${member.member_id}/archive`,
        { reason }
      );
      closeArchive();
      router.refresh();
    } catch {
      // handled by useApi
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    if (!session) return;
    setLoading(true);
    try {
      await api.post(
        `/chapters/${session.chapterId}/members/${member.member_id}/restore`
      );
      router.refresh();
    } catch {
      // handled by useApi
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(isAdmin || isSelf) && (
          <button onClick={() => setEditOpen(true)} className="btn-primary text-sm">
            Edit
          </button>
        )}

        {isAdmin && member.status !== "ARCHIVED" && (
          <button
            onClick={() => setArchiveOpen(true)}
            className="btn-secondary text-sm text-bni-red border-bni-red hover:bg-bni-red/5"
          >
            Archive
          </button>
        )}

        {isAdmin && member.status === "ARCHIVED" && (
          <button onClick={handleRestore} disabled={loading} className="btn-secondary text-sm">
            {loading ? "Restoring..." : "Restore"}
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setResetPwOpen(true)}
            className="btn-secondary text-sm"
          >
            Reset Password
          </button>
        )}
      </div>

      {/* Edit Drawer */}
      {editOpen && (
        <MemberEditDrawer member={member} onClose={closeEdit} />
      )}

      {/* Archive Confirm */}
      {archiveOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="card w-full max-w-sm">
            <h3 className="font-semibold text-lg mb-3">Archive {member.full_name}?</h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-field min-h-[80px] mb-3"
              placeholder="Reason for archiving..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleArchive}
                disabled={loading || !reason.trim()}
                className="btn-primary flex-1 bg-bni-red hover:bg-bni-red/90 disabled:opacity-50"
              >
                {loading ? "Archiving..." : "Archive"}
              </button>
              <button onClick={closeArchive} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwOpen && (
        <ResetPasswordModal
          memberId={member.member_id}
          memberName={member.full_name}
          onClose={() => setResetPwOpen(false)}
        />
      )}
    </>
  );
}
