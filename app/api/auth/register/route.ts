import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { allowedRoles } from "@/lib/user";
import { NextRequest, NextResponse } from "next/server";
import { $Enums } from "@/generated/prisma/client";

interface RegisterBody {
  email: string;
  username: string;
  password: string;
  role: $Enums.Role;
}

export async function POST(req: NextRequest) {
  try {
    const body: RegisterBody = await req.json();
    const { email, username, password, role } = body;

    // ── Validaciones básicas ──────────────────────
    if (!email || !username || !password || !role) {
      return NextResponse.json(
        {
          success: false,
          error: "email, username, password y role son obligatorios",
        },
        { status: 400 },
      );
    }

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: "role no encontrado" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "La contraseña debe tener mínimo 8 caracteres",
        },
        { status: 400 },
      );
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Formato de email inválido" },
        { status: 400 },
      );
    }

    // ── Verificar que no exista ya ───────────────
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() },
        ],
      },
    });

    if (existing) {
      const field =
        existing.email === email.toLowerCase() ? "email" : "username";
      return NextResponse.json(
        { success: false, error: `Este ${field} ya está registrado` },
        { status: 409 },
      );
    }

    // ── Crear usuario ────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password: hashedPassword,
        role,
        // Si es tipster, crear sus stats vacías automáticamente
        ...(role === $Enums.Role.TIPSTER && {
          stats: { create: {} },
        }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    // ── Generar JWT ──────────────────────────────
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Cuenta creada exitosamente",
        data: { user, token },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/auth/register]", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
