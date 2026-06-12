import { NextResponse } from "next/server";
import { getTodayFixtures } from "@/lib/api-football";

export async function GET() {
  const fixtures = await getTodayFixtures();

  // Agrupar por liga para mejor UX en el frontend
  const byLeague = fixtures.reduce<Record<string, typeof fixtures>>(
    (acc, f) => {
      const key = `${f.country} — ${f.league}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    },
    {},
  );

  return NextResponse.json({
    success: true,
    data: {
      fixtures,
      byLeague,
      total: fixtures.length,
      date: new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Bogota",
      }),
    },
  });
}
