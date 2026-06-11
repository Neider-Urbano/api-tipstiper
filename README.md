# 🎯 Tipster Platform

El primer marketplace de tipsters verificados para Latinoamérica.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 + TypeScript |
| Base de datos | PostgreSQL via [Supabase](https://supabase.com) |
| ORM | **Prisma 7** |
| Deploy | Vercel |
| Pagos | Wompi (COP) + Stripe (USD) |
| API deportes | [API-Football](https://www.api-football.com) |

---

## Setup en 4 pasos

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

| Variable | Dónde conseguirla |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → URI |
| `API_FOOTBALL_KEY` | [dashboard.api-football.com](https://dashboard.api-football.com) |

### 3. Generar Prisma Client y migrar la DB

```bash
# Genera el cliente tipado en /generated/prisma
npx prisma generate

# Crea las tablas en tu base de datos Supabase
npx prisma migrate dev --name init
```

### 4. Correr en desarrollo

```bash
npm run dev
```

Verifica en: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## Nota importante: Prisma 7

Este proyecto usa **Prisma 7**, que cambió la forma de configurar la conexión:

| Antes (Prisma 6) | Ahora (Prisma 7) |
|---|---|
| `url = env("DATABASE_URL")` en `schema.prisma` | `url: env("DATABASE_URL")` en `prisma.config.ts` |
| `new PrismaClient()` directo | `new PrismaClient({ adapter })` con driver adapter |

Los archivos clave son:
- `prisma.config.ts` → URL de conexión y paths de migración
- `prisma/schema.prisma` → Solo modelos, sin URL
- `lib/prisma.ts` → Cliente con `@prisma/adapter-pg`

---

## Endpoints disponibles

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api` | Info de la API y endpoints |
| `GET` | `/api/health` | Estado del servidor + conexión DB |

---

## Estructura del proyecto

```
tipster-platform/
├── app/
│   └── api/
│       ├── route.ts              # GET /api
│       └── health/route.ts       # GET /api/health
├── generated/
│   └── prisma/                   # Cliente generado (npx prisma generate)
├── lib/
│   └── prisma.ts                 # Singleton Prisma Client con adapter
├── prisma/
│   ├── schema.prisma             # Modelos (sin URL — Prisma 7)
│   └── migrations/               # Migraciones SQL generadas
├── prisma.config.ts              # ← Nuevo en Prisma 7: URL + paths
├── .env                          # Variables locales (no subir al repo)
└── .env.example                  # Plantilla de variables
```

---

## Comandos útiles

```bash
npm run dev                              # Servidor de desarrollo
npx prisma generate                      # Regenerar cliente tipado
npx prisma migrate dev --name <nombre>   # Nueva migración
npx prisma studio                        # GUI de la base de datos
npx prisma migrate deploy                # Aplicar migraciones en producción
```
