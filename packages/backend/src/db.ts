import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

function ensureSqliteDirectory() {
  const url = process.env.DATABASE_URL ?? "file:../data/gcodeline.db";
  if (!url.startsWith("file:")) {
    return;
  }

  const sqlitePath = url.replace(/^file:/, "");
  const absolutePath = resolve(join(process.cwd(), "prisma", sqlitePath));
  mkdirSync(resolve(absolutePath, ".."), { recursive: true });
}

export function createDatabase() {
  ensureSqliteDirectory();
  return new PrismaClient();
}
