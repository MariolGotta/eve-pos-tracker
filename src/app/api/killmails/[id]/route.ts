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

  const VALID_SHIP_TYPES = new Set(["SUBCAP", "POS", "CAPITAL"]);
  const VALID_STATUSES   = new Set(["PENDING", "COMPLETE"]);

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

  // ── Input validation ──────────────────────────────────────────────────────
  if (iskValue !== undefined) {
    try { BigInt(String(iskValue)); } catch {
      return NextResponse.json({ error: "iskValue must be a whole number" }, { status: 400 });
    }
    if (BigInt(String(iskValue)) < 0n)
      return NextResponse.json({ error: "iskValue cannot be negative" }, { status: 400 });
  }
  if (participantsTotal !== undefined && participantsTotal !== null && participantsTotal !== "") {
    const pt = Number(participantsTotal);
    if (!Number.isInteger(pt) || pt < 0)
      return NextResponse.json({ error: "participantsTotal must be a non-negative integer" }, { status: 400 });
  }
  if (shipType !== undefined && !VALID_SHIP_TYPES.has(String(shipType)))
    return NextResponse.json({ error: `shipType must be one of: ${[...VALID_SHIP_TYPES].join(", ")}` }, { status: 400 });
  if (newStatus !== undefined && !VALID_STATUSES.has(String(newStatus)))
    return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
  if (timestampUtc !== undefined) {
    const d = new Date(String(timestampUtc));
    if (isNaN(d.getTime()))
      return NextResponse.json({ error: "timestampUtc is not a valid date" }, { status: 400 });
  }
  if (victimPilot   !== undefined && String(victimPilot).length   > 200)
    return NextResponse.json({ error: "victimPilot exceeds 200 characters" }, { status: 400 });
  if (victimCorpTag !== undefined && String(victimCorpTag).length > 10)
    return NextResponse.json({ error: "victimCorpTag exceeds 10 characters" }, { status: 400 });
  if (victimShip    !== undefined && String(victimShip).length    > 200)
    return NextResponse.json({ error: "victimShip exceeds 200 characters" }, { status: 400 });
  if (system        !== undefined && String(system).length        > 100)
    return NextResponse.json({ error: "system exceeds 100 characters" }, { status: 400 });
  if (region        !== undefined && region && String(region).length > 100)
    return NextResponse.json({ error: "region exceeds 100 characters" }, { status: 400 });
  if (newId         !== undefined && String(newId).trim().length  > 50)
    return NextResponse.json({ error: "killmail id exceeds 50 characters" }, { status: 400 });

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
  if (victimPilot !== undefined) updateData.victimPilot = String(victimPilot).trim();
  if (victimCorpTag !== undefined) updateData.victimCorpTag = String(victimCorpTag).trim().toUpperCase();
  if (victimShip !== undefined) updateData.victimShip = String(victimShip).trim();
  if (system !== undefined) updateData.system = String(system).trim();
  if (region !== undefined) updateData.region = region ? String(region).trim() : null;
  if (timestampUtc !== undefined) updateData.timestampUtc = new Date(String(timestampUtc));
  if (shipType !== undefined) updateData.shipType = String(shipType);
  if (newStatus !== undefined) updateData.status = String(newStatus);

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
