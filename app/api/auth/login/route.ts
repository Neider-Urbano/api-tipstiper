import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "email y password son obligatorios" },
        { status: 400 },
      );
    }

    // Buscar usuario — incluimos password solo para comparar
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        password: true, // solo aquí, nunca lo devolvemos
        isVerified: true,
      },
    });

    // Mensaje genérico para no revelar si el email existe
    const invalidMsg = "Email o contraseña incorrectos";

    if (!user) {
      return NextResponse.json(
        { success: false, error: invalidMsg },
        { status: 401 },
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, error: invalidMsg },
        { status: 401 },
      );
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Devolver usuario sin la contraseña
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      message: "Sesión iniciada correctamente",
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
