import Report, { initializeReportStorage } from "../models/Report.js";
import { demoReports } from "./reports.js";
import { createHash } from "node:crypto";
import Area from "../models/Area.js";
import { demoAreas } from "./areas.js";
import { detectShortages } from "../services/shortageService.js";
import { loadEnv } from "../config/env.js";

export async function seedDemoReports(config = loadEnv()) {
  if (config.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production.");
  await initializeReportStorage();
  // Replace only the obsolete Phase 2 seed owned by this project, never citizens.
  await Report.deleteMany({
    isDemo: true,
    reporterKeyHash: createHash("sha256")
      .update("aquashield-fictional-demo-citizen")
      .digest("hex"),
  });
  for (const area of demoAreas())
    await Area.updateOne(
      { _id: area._id, isDemo: true },
      { $set: area },
      { upsert: true },
    );
  for (const report of demoReports()) {
    await Report.updateOne(
      {
        reporterKeyHash: report.reporterKeyHash,
        submissionId: report.submissionId,
        isDemo: true,
      },
      { $setOnInsert: report },
      { upsert: true, timestamps: false },
    );
  }
  await detectShortages(config, { demo: true });
}
