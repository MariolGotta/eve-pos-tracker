import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonBig } from "@/lib/json-response";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function isBotRequest(req: NextRequest) {
  return req.headers.get("x-bot-secret") === process.env.BOT_SHARED_SECRET;
}

// ─── GET /api/killmails/[id] ──────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const isBot = isBotRequest(req);
  if (!isBot) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const km = await db.killmail.findUnique({
    where: { id: params.id },
    include: {
      attackers: { orderBy: { damagePct: "desc" } },
    },
  });

  if (!km) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return jsonBig(km);
}

// ─── PATCH /api/killmails/[id] ────────────────────────────────────────────────
// ADMIN/OWNER. Edit killmail metadata. Supports renaming the ID.

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const km = await db.killmail.findUnique({ where: { id: params.id } });
  if (!km) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const {
    newId,
    iskValue,
    participantsTotal,
    victimPilot,
    victimCorpTag,
    victimShip,
    system,
    region,
    timestampUtc,
    shipType,
    status: newStatus,
  } = body;

  const targetId = newId && String(newId).trim() !== params.id ? String(newId).trim() : null;

  // If renaming the ID, use raw SQL UPDATE so FK ON UPDATE CASCADE propagates
  if (targetId) {
    const exists = await db.killmail.findUnique({ where: { id: targetId } });
    if (exists) return NextResponse.json({ error: `Killmail ID ${targetId} already exists` }, { status: 409 });
    await db.$executeRawUnsafe(`UPDATE "Killmail" SET id = $1 WHERE id = $2`, targetId, params.id);
  }

  const activeId = targetId ?? params.id;

  // Build update payload
  const updateData: Record<string, unknown> = {};
  if (iskValue !== undefined) updateData.iskValue = BigInt(String(iskValue));
  if (participantsTotal !== undefined) updateData.participantsTotal = participantsTotal !== null && participantsTotal !== "" ? Number(participantsTotal) : null;
  if (victimPilot !== undefined) updateData.victimPilot = String(victimPilot);
  if (victimCorpTag !== undefined) updateData.victimCorpTag = String(victimCorpTag);
  if (victimShip !== undefined) updateData.victimShip = String(victimShip);
  if (system !== undefined) updateData.system = String(system);
  if (region !== undefined) updateData.region = region ? String(region) : null;
  if (timestampUtc !== undefined) updateData.timestampUtc = new Date(String(timestampUtc));
  if (shipType !== undefined) updateData.shipType = shipType;
  if (newStatus !== undefined) updateData.status = newStatus;

  if (Object.keys(updateData).length > 0) {
    await db.killmail.update({ where: { id: activeId }, data: updateData });
  }

  // Build diff payload — only fields that actually changed
  const diffPayload: Record<string, unknown> = {};
  if (targetId) diffPayload.id = `${params.id} → ${targetId}`;
  if (iskValue !== undefined && BigInt(String(iskValue)) !== BigInt(String(km.iskValue)))
    diffPayload.iskValue = String(iskValue);
  if (participantsTotal !== undefined) {
    const newPT = participantsTotal !== null && participantsTotal !== "" ? Number(participantsTotal) : null;
    if (newPT !== km.participantsTotal) diffPayload.participantsTotal = newPT;
  }
  if (victimPilot !== undefined && String(victimPilot) !== km.victimPilot)
    diffPayload.victimPilot = String(victimPilot);
  if (victimCorpTag !== undefined && String(victimCorpTag) !== km.victimCorpTag)
    diffPayload.victimCorpTag = String(victimCorpTag);
  if (victimShip !== undefined && String(victimShip) !== km.victimShip)
    diffPayload.victimShip = String(victimShip);
  if (system !== undefined && String(system) !== km.system)
    diffPayload.system = String(system);
  if (region !== undefined && (region ? String(region) : null) !== km.region)
    diffPayload.region = region || null;
  if (timestampUtc !== undefined &&
      new Date(String(timestampUtc)).toISOString() !== new Date(km.timestampUtc).toISOString())
    diffPayload.timestampUtc = String(timestampUtc).slice(0, 16);
  if (shipType !== undefined && shipType !== km.shipType)
    diffPayload.shipType = `${km.shipType} → ${shipType}`;
  if (newStatus !== undefined && newStatus !== km.status)
    diffPayload.status = `${km.status} → ${newStatus}`;

  // Log event
  await db.killmailEvent.create({
    data: {
      killmailId: activeId,
      userId: session.user.userId,
      action: "EDITED",
      payload: Object.keys(diffPayload).length > 0 ? diffPayload : { noChanges: true },
    },
  });

  return jsonBig({ ok: true, id: activeId });
}

// ─── DELETE /api/killmails/[id] ───────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const km = await db.killmail.findUnique({
    where: { id: params.id },
    include: { attackers: true },
  });
  if (!km) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.$transaction(async (tx: any) => {
    if (km.status === "COMPLETE") {
      for (const a of km.attackers) {
        if (a.iskEarned && a.iskEarned > BigInt(0)) {
          await tx.player.updateMany({
            where: { pilot: a.pilot },
            data: {
              totalEarned: { decrement: a.iskEarned },
              remaining: { decrement: a.iskEarned },
            },
          });
        }
      }
    }
    // Events cascade-delete with the killmail (onDelete: Cascade)
    await tx.killmail.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
