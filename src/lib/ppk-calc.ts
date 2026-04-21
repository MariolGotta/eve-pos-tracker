/**
 * PPK (Pay Per Kill) Calculation Pipeline
 *
 * Replica as fórmulas da aba "ISK" do BOT5 DECEMBER PPK.xlsx:
 *   K  = min(iskValue, subcapCap se subcap) * damagePct/100
 *   L  = K * (bot5Coef se corp elegível, senão nonBot5Coef)
 *   P  = L * subcapMultiplier                    [subcap]
 *   Q  = posFixedIsk * (L/K) * (pct/100)         [pos]
 *   R  = (damage / damageSemSuper) * capitalFixed * 0.9   [capital]
 *   W  = P + Q + R  →  iskEarned por attacker
 */

// ShipType mirrors the Prisma enum — defined locally so this file compiles
// before `prisma generate` has been run.
export type ShipType = "SUBCAP" | "POS" | "CAPITAL";

// ─── Ship type detection ──────────────────────────────────────────────────────
// Baseado em parser_finalblow.py:134

const POS_KEYWORDS = [
  "citadela",
  "citadel",
  "control tower",
  "pos",
  "station",
  "outpost",
  "posto avançado",
  "engineering complex",
  "refinery",
  "upwell",
];

const CAPITAL_KEYWORDS = [
  "carrier",
  "dreadnought",
  "supercarrier",
  "titan",
  "force auxiliary",
  "rorqual",
  "phoenix",
  "revelation",
  "naglfar",
  "moros",
  "nyx",
  "hel",
  "thanatos",
  "archon",
  "chimera",
  "nidhoggur",
  "aeon",
  "wyvern",
  "avatar",
  "erebus",
  "leviathan",
  "ragnarok",
  "apostle",
  "minokawa",
  "ninazu",
  "lif",
  "hel",
];

export function detectShipType(victimShip: string): ShipType {
  const lower = victimShip.toLowerCase();

  if (POS_KEYWORDS.some((kw) => lower.includes(kw))) return "POS";
  if (CAPITAL_KEYWORDS.some((kw) => lower.includes(kw))) return "CAPITAL";
  return "SUBCAP";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttackerInput {
  pilot: string;
  corpTag: string;
  ship: string;
  damage: number;
  damagePct: number;
  finalBlow: boolean;
  topDamage: boolean;
}

export interface AttackerResult extends AttackerInput {
  iskEarned: bigint;
  isEligible: boolean; // corp is in bot5 list
}

export interface PpkConfigInput {
  subcapMultiplier: number;
  posFixedIsk: bigint;
  capitalFixedIsk: bigint;
  bot5Coefficient: number;
  nonBot5Coefficient: number;
  subcapCapIsk: bigint;
}

// ─── Core calculation ─────────────────────────────────────────────────────────

export function computeKillmailPayouts(
  iskValue: bigint,
  shipType: ShipType,
  attackers: AttackerInput[],
  eligibleCorpTags: Set<string>,
  config: PpkConfigInput
): AttackerResult[] {
  const iskValueNum = Number(iskValue);
  const subcapCapNum = Number(config.subcapCapIsk);
  const posFixedNum = Number(config.posFixedIsk);
  const capitalFixedNum = Number(config.capitalFixedIsk);

  // Para capital: soma de dano dos não-super (simplificação: sem lista de supers,
  // usa dano total de todos os atacantes)
  const damageSemSuper = attackers.reduce((sum, a) => sum + a.damage, 0) || 1;

  return attackers.map((attacker) => {
    const pct = attacker.damagePct / 100;
    const isEligible = eligibleCorpTags.has(attacker.corpTag.toUpperCase());
    const coef = isEligible ? config.bot5Coefficient : config.nonBot5Coefficient;

    let K = 0;
    let L = 0;
    let P = 0;
    let Q = 0;
    let R = 0;

    if (shipType === "SUBCAP") {
      // K = min(iskValue, 15B) * damagePct/100
      K = Math.min(iskValueNum, subcapCapNum) * pct;
      L = K * coef;
      P = L * config.subcapMultiplier;
    } else if (shipType === "POS") {
      // K = iskValue * damagePct/100  (sem cap para POS)
      K = iskValueNum * pct;
      L = K * coef;
      // Q = posFixedIsk * (L/K) * pct  — se K=0 evita divisão
      Q = K > 0 ? posFixedNum * (L / K) * pct : 0;
    } else {
      // CAPITAL
      // K = iskValue * damagePct/100
      K = iskValueNum * pct;
      L = K * coef;
      // R = (damage / damageSemSuper) * capitalFixed * 0.9
      R =
        damageSemSuper > 0
          ? (attacker.damage / damageSemSuper) * capitalFixedNum * 0.9
          : 0;
    }

    const iskEarnedNum = Math.round(P + Q + R);

    return {
      ...attacker,
      iskEarned: BigInt(iskEarnedNum),
      isEligible,
    };
  });
}

// ─── Cost estimate helper (para logging) ─────────────────────────────────────

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheReadPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-haiku-4-5-20251001": {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cacheWritePerMillion: 1.0,
    cacheReadPerMillion: 0.08,
  },
  "claude-3-5-sonnet-20241022": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-3-5-sonnet-20241022"];
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion +
    (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMillion
  );
}
