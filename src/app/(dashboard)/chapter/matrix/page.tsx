"use client";

import { useSession } from "@/lib/SessionContext";
import MatrixGrid from "@/components/matrix/MatrixGrid";
import EmptyState from "@/components/ui/EmptyState";
import { Lock } from "lucide-react";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

export default function MatrixPage() {
  const { session } = useSession();

  if (!session) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-8 w-56 shimmer rounded-lg" />
        <div className="h-5 w-72 shimmer rounded" />
        <div className="h-[500px] shimmer rounded-xl" />
      </div>
    );
  }

  if (!LT_ROLES.includes(session.role)) {
    return (
      <div className="max-w-lg mx-auto">
        <EmptyState
          icon={<Lock className="w-7 h-7" />}
          title="Access Denied"
          description="Only Leadership Team members can view the engagement matrix."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <MatrixGrid chapterId={session.chapterId} />
    </div>
  );
}
