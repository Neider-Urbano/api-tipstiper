import { getFixtureById } from "@/lib/api-football";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const fixtureId = Number(params.id);

  if (isNaN(fixtureId)) {
    return NextResponse.json(
      { success: false, error: "ID de partido inválido" },
      { status: 400 },
    );
  }

  const fixture = await getFixtureById(fixtureId);

  if (!fixture) {
    return NextResponse.json(
      { success: false, error: "Partido no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: { fixture } });
}
