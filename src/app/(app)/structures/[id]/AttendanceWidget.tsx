"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Attendee {
  userId: string;
  username: string;
  avatarUrl: string | null;
  discordId: string;
}

interface Props {
  timerId: string;
  initialAttendees: Attendee[];
  currentUserId: string;
}

export default function AttendanceWidget({ timerId, initialAttendees, currentUserId }: Props) {
  const router = useRouter();
  const [attendees, setAttendees] = useState<Attendee[]>(initialAttendees);
  const [isPending, startTransition] = useTransition();

  const isAttending = attendees.some((a) => a.userId === currentUserId);

  function toggle() {
    startTransition(async () => {
      const res = await fetch(`/api/timers/${timerId}/attend`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.attending) {
        router.refresh(); // fetch updated attendee list from server
      } else {
        setAttendees((prev) => prev.filter((a) => a.userId !== currentUserId));
      }
    });
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-eve-muted uppercase tracking-wide">
          Going ({attendees.length})
        </p>
        <button
          onClick={toggle}
          disabled={isPending}
          className={`text-xs px-3 py-1 rounded border font-semibold transition-colors ${
            isAttending
              ? "bg-green-500/20 border-green-500/50 text-green-300 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300"
              : "bg-eve-accent/10 border-eve-accent/40 text-eve-accent hover:bg-eve-accent/20"
          }`}
        >
          {isPending ? "…" : isAttending ? "✓ Going (click to leave)" : "+ I'm Going"}
        </button>
      </div>

      {attendees.length === 0 ? (
        <p className="text-xs text-eve-muted">Nobody signed up yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {attendees.map((a) => (
            <a
              key={a.userId}
              href={`https://discord.com/users/${a.discordId}`}
              target="_blank"
              rel="noopener noreferrer"
              title={a.username}
              className="flex items-center gap-1.5 bg-eve-bg rounded-full px-2 py-1 hover:bg-eve-border transition-colors"
            >
              {a.avatarUrl ? (
                <img
                  src={a.avatarUrl}
                  alt={a.username}
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-eve-accent/30 flex items-center justify-center text-[10px] text-eve-accent font-bold">
                  {a.username[0].toUpperCase()}
                </div>
              )}
              <span className="text-xs text-gray-300">{a.username}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
