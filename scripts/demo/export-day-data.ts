/**
 * Export DayDefinitions from Payload DB → JSON for Remotion video.
 * Run: npx tsx scripts/demo/export-day-data.ts
 */
import { getPayload } from "payload";
import config from "@/payload.config";
import fs from "fs";
import path from "path";

type DayData = {
  day: number;
  title: string;
  theme: string;
  blockType: string;
  blockFocus: string;
  deliverable: string;
  founderCommandment: string;
  isGate: boolean;
  isWeekly: boolean;
};

async function main() {
  const payload = await getPayload({ config });

  // Fetch all day, weekly, and gate definitions
  const result = await payload.find({
    collection: "day-definitions",
    where: {
      blockType: { in: ["day", "weekly", "gate"] },
    },
    limit: 500,
    sort: "order",
    depth: 0,
  });

  const days: DayData[] = result.docs
    .filter((d: any) => d.dayNumber != null && d.dayNumber >= 1 && d.dayNumber <= 100)
    .map((d: any) => ({
      day: d.dayNumber,
      title: d.title || "",
      theme: d.theme || "",
      blockType: d.blockType || "day",
      blockFocus: d.blockFocus || "",
      deliverable: d.deliverable || "",
      founderCommandment: d.founderCommandment || "",
      isGate: d.blockType === "gate" || d.isGateDay === true,
      isWeekly: d.blockType === "weekly",
    }))
    .sort((a: DayData, b: DayData) => a.day - b.day);

  // De-duplicate by day number (keep gate/weekly over standard if same day)
  const byDay = new Map<number, DayData[]>();
  for (const d of days) {
    if (!byDay.has(d.day)) byDay.set(d.day, []);
    byDay.get(d.day)!.push(d);
  }

  const merged: DayData[] = [];
  for (const [dayNum, entries] of byDay) {
    // Prefer gate > weekly > day
    const gate = entries.find((e) => e.isGate);
    const weekly = entries.find((e) => e.isWeekly);
    const standard = entries.find((e) => !e.isGate && !e.isWeekly);

    if (gate) merged.push(gate);
    else if (weekly) merged.push(weekly);
    else if (standard) merged.push(standard);
  }
  merged.sort((a, b) => a.day - b.day);

  const outDir = path.resolve(__dirname, "../../video/src/data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "dayDefinitions.json"),
    JSON.stringify(merged, null, 2)
  );

  console.log(`Exported ${merged.length} day definitions to video/src/data/dayDefinitions.json`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
