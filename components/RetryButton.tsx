"use client";
import { useRouter } from "next/navigation";

export default function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="ghost"
      onClick={async () => {
        await fetch(`/api/people/${id}/retry`, { method: "POST" });
        router.refresh();
      }}
    >
      Retry
    </button>
  );
}
