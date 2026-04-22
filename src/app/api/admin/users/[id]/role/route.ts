import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/admin/users/[id]/role
// OWNER only. Promotes MEMBER→ADMIN or demotes ADMIN→MEMBER.
// OWNER role is immutable — cannot be changed here.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OWNER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { role } = await req.json();
  if (role !== "ADMIN" && role !== "MEMBER")
    return NextResponse.json({ error: "role must be ADMIN or MEMBER" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "OWNER")
    return NextResponse.json({ error: "Cannot change OWNER role" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { role },
    select: { id: true, username: true, displayName: true, role: true },
  });

  return NextResponse.json(updated);
}
