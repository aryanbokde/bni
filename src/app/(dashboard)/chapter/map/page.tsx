"use client";

import { useSession } from "@/lib/SessionContext";
import ChapterMap from "@/components/map/ChapterMap";

export default function MapPage() {
  const { session } = useSession();

  if (!session) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-8 w-48 shimmer rounded-lg" />
        <div className="h-[500px] shimmer rounded-xl" />
      </div>
    );
  }

  return <ChapterMap chapterId={session.chapterId} />;
}
