import NodeCache from "node-cache";

const BASE_URL = "https://v3.football.api-sports.io";

// Cache en memoria: TTL de 5 minutos para búsquedas, 1 min para resultados en vivo
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ── Tipos de respuesta de API-Football ──────────────────────────────

export interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string; elapsed: number | null };
    venue: { name: string | null; city: string | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

// Lo que devolvemos al frontend — solo los campos que necesitamos
export interface FixtureDto {
  fixtureId: number;
  date: string;
  status: string; // "NS" | "1H" | "HT" | "2H" | "FT" | "PST" | "CANC"
  league: string;
  country: string;
  leagueLogo: string;
  round: string;
  homeTeam: string;
  homeLogo: string;
  awayTeam: string;
  awayLogo: string;
  goals: { home: number | null; away: number | null };
}

// ── Función base de fetch ────────────────────────────────────────────

async function fetchFootball(
  endpoint: string,
  params: Record<string, string>,
): Promise<ApiFootballFixture[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY no está definida en .env");
  }

  // Construir clave de caché con endpoint + params
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
  const cached = cache.get<ApiFootballFixture[]>(cacheKey);
  if (cached) return cached;

  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": apiKey },
    // Next.js: no cachear a nivel de fetch — lo manejamos nosotros con NodeCache
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football respondió ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  // API-Football devuelve errores dentro del body con status 200
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
  }

  const fixtures: ApiFootballFixture[] = data.response ?? [];
  cache.set(cacheKey, fixtures);

  return fixtures;
}

// ── Mapper: ApiFootballFixture → FixtureDto ──────────────────────────

export function toFixtureDto(f: ApiFootballFixture): FixtureDto {
  return {
    fixtureId: f.fixture.id,
    date: f.fixture.date,
    status: f.fixture.status.short,
    league: f.league.name,
    country: f.league.country,
    leagueLogo: f.league.logo,
    round: f.league.round,
    homeTeam: f.teams.home.name,
    homeLogo: f.teams.home.logo,
    awayTeam: f.teams.away.name,
    awayLogo: f.teams.away.logo,
    goals: f.goals,
  };
}

// ── Funciones públicas del cliente ───────────────────────────────────

// Fecha en formato YYYY-MM-DD en zona horaria de Bogotá
function getBogotaDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
}

// Buscar por nombre de equipo o liga — solo partidos no iniciados
export async function searchFixtures(
  query: string,
  date?: string,
): Promise<FixtureDto[]> {
  const fixtures = await fetchFootball("/fixtures", {
    search: query,
    date: date ?? getBogotaDate(),
    timezone: "America/Bogota",
  });

  return fixtures
    .filter((f) => f.fixture.status.short === "NS") // solo no iniciados
    .map(toFixtureDto);
}

// Partidos de hoy — incluye en curso y no iniciados
export async function getTodayFixtures(): Promise<FixtureDto[]> {
  const fixtures = await fetchFootball("/fixtures", {
    date: getBogotaDate(),
    timezone: "America/Bogota",
  });

  // Excluir cancelados y aplazados
  const excluded = ["CANC", "PST", "ABD", "WO"];
  return fixtures
    .filter((f) => !excluded.includes(f.fixture.status.short))
    .map(toFixtureDto)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Próximos 7 días — solo no iniciados (para que el tipster elija)
export async function getUpcomingFixtures(): Promise<FixtureDto[]> {
  const today = getBogotaDate();
  const in7Days = getBogotaDate(7);

  const fixtures = await fetchFootball("/fixtures", {
    from: today,
    to: in7Days,
    timezone: "America/Bogota",
  });

  return fixtures
    .filter((f) => f.fixture.status.short === "NS")
    .map(toFixtureDto)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Partido específico por ID — para verificación de picks
export async function getFixtureById(id: number): Promise<FixtureDto | null> {
  // Este endpoint no usa caché — necesitamos el resultado más fresco
  cache.del(`/fixtures:{"id":"${id}"}`);

  const fixtures = await fetchFootball("/fixtures", {
    id: String(id),
  });

  if (fixtures.length === 0) return null;
  return toFixtureDto(fixtures[0]);
}
