import { existsSync } from "node:fs";

const expected = [
  "GCodeLine.uplugin",
  "Source/GCodeLine/GCodeLine.Build.cs",
  "Source/GCodeLine/Public/GCodeLineSubsystem.h",
  "Source/GCodeLine/Private/GCodeLineSubsystem.cpp"
];

const missing = expected.filter((entry) => !existsSync(new URL(`../${entry}`, import.meta.url)));

if (missing.length > 0) {
  console.error("Missing Unreal plugin files:");
  for (const file of missing) {
    console.error(` - ${file}`);
  }
  process.exit(1);
}

console.log("Unreal plugin skeleton looks good.");
