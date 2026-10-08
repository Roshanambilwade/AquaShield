import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    eventKey: { type: String, required: true },
    isDemo: { type: Boolean, required: true },
    areaId: { type: String, default: null },
    areaName: { type: String, required: true },
    center: { lat: Number, lng: Number },
    reportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Report" }],
    duplicateReportIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
    ],
    suspiciousReportIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
    ],
    reportCount: Number,
    eligibleReportCount: Number,
    verifiedReportCount: Number,
    duplicateReportCount: Number,
    suspiciousReportCount: Number,
    confidenceScore: { type: Number, min: 0, max: 100 },
    estimatedAffectedPopulation: Number,
    durationHours: { type: Number, default: null },
    temperatureC: { type: Number, default: null },
    vulnerableRatio: { type: Number, default: null },
    waterLevelScore: { type: Number, default: null },
    severityScore: { type: Number, min: 0, max: 100 },
    severityLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    },
    status: {
      type: String,
      enum: ["EMERGING", "ACTIVE", "HISTORICAL", "SUPERSEDED"],
    },
    confidence: mongoose.Schema.Types.Mixed,
    population: mongoose.Schema.Types.Mixed,
    severity: mongoose.Schema.Types.Mixed,
    evidence: [String],
    firstReportAt: Date,
    lastReportAt: Date,
    calculatedAt: Date,
  },
  { timestamps: true, strict: "throw", autoCreate: false, autoIndex: false },
);
schema.index({ eventKey: 1 }, { unique: true });
schema.index({ isDemo: 1, status: 1, severityScore: -1 });
schema.index({ reportIds: 1 });
const ShortageEvent = mongoose.model("ShortageEvent", schema);
const initialized = new WeakMap();
export function initializeShortageStorage() {
  const database = ShortageEvent.db.db;
  if (!database) throw new Error("MongoDB is not connected.");
  if (!initialized.has(database))
    initialized.set(
      database,
      ShortageEvent.createIndexes().catch((error) => {
        initialized.delete(database);
        throw error;
      }),
    );
  return initialized.get(database);
}
export default ShortageEvent;
