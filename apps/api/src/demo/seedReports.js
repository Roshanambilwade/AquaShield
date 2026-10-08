import Report, { initializeReportStorage } from "../models/Report.js";
import { demoReports } from "./reports.js";

export async function seedDemoReports() {
  await initializeReportStorage();
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
}
