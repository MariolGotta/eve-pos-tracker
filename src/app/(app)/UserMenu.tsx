"use client";
import { signOut } from "next-auth/react";
import Image from "next/image";

interface Props {
  user: {
    name?: string | null;
    image?: string | null;
    role: string;
  };
}

export default function UserMenu({ user }: Props) {
  return (
    <div className="flex items-center gap-3">
      {user.image && (
        <Image
          src={user.image}
          alt={user.name ?? ""}
          width={28}
          height={28}
          className="rounded-full"
        />
      )}
      <span className="text-xs text-gray-400 hidden sm:block">
        {user.name}
        {user.role === "OWNER" && (
          <span className="ml-1 text-eve-gold">[OWNER]</span>
        )}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="btn-ghost text-xs px-3 py-1.5"
      >
        Logout
      </button>
    </div>
  );
}
