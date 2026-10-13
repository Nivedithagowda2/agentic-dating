"use client";
import { useRouter } from "next/navigation";

export default function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="ghost"
      onClick={async () => {
        if (!confirm("Remove this person and all their dates?")) return;
        await fetch(`/api/people/${id}`, { method: "DELETE" });
        router.push("/");
        router.refresh();
      }}
    >
      Remove me / delete data
    </button>
  );
}
