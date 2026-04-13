import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

function ensureSqliteDirectory() {
  const url = process.env.DATABASE_URL ?? "file:./gcodeline.db";
  if (!url.startsWith("file:")) {
    return;
  }

  const sqlitePath = url.replace(/^file:/, "");
  const absolutePath = isAbsolute(sqlitePath)
    ? sqlitePath
    : resolve(process.cwd(), "prisma", sqlitePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
}

export function createDatabase() {
  ensureSqliteDirectory();
  return new PrismaClient();
}
