import { FixtureDto } from "./api-football";
import { PickStatus } from "../generated/prisma/client";

// ── Tipos de apuesta válidos en el MVP ──────────────────────────────

export const VALID_PICK_TYPES = [
  "1X2",
  "BTTS",
  "Over/Under",
  "Doble oportunidad",
] as const;

export type PickType = (typeof VALID_PICK_TYPES)[number];

// Valores válidos por tipo de apuesta
export const VALID_PICK_VALUES: Record<PickType, string[]> = {
  "1X2": ["Local", "Empate", "Visitante"],
  BTTS: ["Sí", "No"],
  "Over/Under": [
    "Over 1.5",
    "Over 2.5",
    "Over 3.5",
    "Under 1.5",
    "Under 2.5",
    "Under 3.5",
  ],
  "Doble oportunidad": ["1X", "X2", "12"],
};

// ── Validación de un pick antes de guardarlo ─────────────────────────

export interface PickInput {
  matchId: string;
  matchDate: string; // ISO string de la fecha del partido
  pickType: string;
  pickValue: string;
  odds: number;
  stake: number;
  isPremium: boolean;
  analysis?: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePickInput(input: PickInput): ValidationResult {
  const { matchDate, pickType, pickValue, odds, stake } = input;

  // El partido no debe haber empezado
  if (new Date(matchDate) <= new Date()) {
    return {
      valid: false,
      error:
        "No puedes publicar un pick para un partido que ya comenzó o terminó",
    };
  }

  // Tipo de apuesta válido
  if (!VALID_PICK_TYPES.includes(pickType as PickType)) {
    return {
      valid: false,
      error: `pickType inválido. Opciones: ${VALID_PICK_TYPES.join(", ")}`,
    };
  }

  // Valor válido para ese tipo
  const validValues = VALID_PICK_VALUES[pickType as PickType];
  if (!validValues.includes(pickValue)) {
    return {
      valid: false,
      error: `pickValue inválido para ${pickType}. Opciones: ${validValues.join(", ")}`,
    };
  }

  // Cuota mínima 1.01
  if (odds < 1.01 || odds > 1000) {
    return { valid: false, error: "La cuota debe estar entre 1.01 y 1000" };
  }

  // Stake entre 1 y 10 unidades
  if (!Number.isInteger(stake) || stake < 1 || stake > 10) {
    return {
      valid: false,
      error: "El stake debe ser un número entero entre 1 y 10",
    };
  }

  return { valid: true };
}

// ── Verificación del resultado contra API-Football ────────────────────

export function verifyPickResult(
  pickType: string,
  pickValue: string,
  fixture: FixtureDto,
): PickStatus {
  const status = fixture.status;
  const home = fixture.goals.home;
  const away = fixture.goals.away;

  // Partido cancelado, aplazado o abandonado → VOID
  if (["CANC", "PST", "ABD", "WO"].includes(status)) {
    return PickStatus.VOID;
  }

  // Partido aún no terminó → seguir esperando
  if (!["FT", "AET", "PEN"].includes(status)) {
    return PickStatus.LOCKED;
  }

  // Sin datos de goles → VOID
  if (home === null || away === null) {
    return PickStatus.VOID;
  }

  switch (pickType as PickType) {
    case "1X2":
      if (pickValue === "Local")
        return home > away ? PickStatus.WON : PickStatus.LOST;
      if (pickValue === "Empate")
        return home === away ? PickStatus.WON : PickStatus.LOST;
      if (pickValue === "Visitante")
        return away > home ? PickStatus.WON : PickStatus.LOST;
      break;

    case "BTTS": {
      const bothScored = home > 0 && away > 0;
      return (pickValue === "Sí") === bothScored
        ? PickStatus.WON
        : PickStatus.LOST;
    }

    case "Over/Under": {
      const total = home + away;
      const line = parseFloat(
        pickValue.replace("Over ", "").replace("Under ", ""),
      );
      const isOver = pickValue.startsWith("Over");
      return (isOver ? total > line : total < line)
        ? PickStatus.WON
        : PickStatus.LOST;
    }

    case "Doble oportunidad":
      if (pickValue === "1X")
        return home >= away ? PickStatus.WON : PickStatus.LOST;
      if (pickValue === "X2")
        return away >= home ? PickStatus.WON : PickStatus.LOST;
      if (pickValue === "12")
        return home !== away ? PickStatus.WON : PickStatus.LOST;
      break;
  }

  return PickStatus.VOID;
}
