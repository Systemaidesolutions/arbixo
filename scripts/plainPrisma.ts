// Plain Prisma client for one-off scripts run with tsx (scripts/tsconfig.seed.json
// maps "@/lib/prisma" here). The app's lib/prisma adds an audit extension that
// needs the Next.js request context, which a script doesn't have.
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
