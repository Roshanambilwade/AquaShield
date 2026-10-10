import mongoose from "mongoose";
const audit = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "CREATED",
        "ESCALATED",
        "DEESCALATED",
        "UPDATED",
        "DATA_UNAVAILABLE",
        "REOPENED",
        "ACKNOWLEDGED",
        "RESOLVED",
      ],
      required: true,
    },
    at: { type: Date, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
    revision: { type: Number, required: true },
    previousRiskLevel: String,
    riskLevel: String,
    previousStatus: String,
    status: String,
    predictionKey: String,
    note: { type: String, maxlength: 300, default: "" },
  },
  { _id: false },
);
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    areaId: { type: String, required: true },
    areaName: { type: String, required: true },
    horizonHours: { type: Number, required: true },
    modelVersion: { type: String, required: true },
    configVersion: { type: String, required: true },
    isDemo: { type: Boolean, required: true, immutable: true },
    provenance: { type: String, required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"],
      default: "ACTIVE",
    },
    revision: { type: Number, default: 1 },
    cycle: { type: Number, default: 1 },
    conditionKey: { type: String, required: true },
    predictionKey: { type: String, required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    audit: { type: [audit], required: true },
  },
  { strict: "throw", timestamps: true, autoCreate: false, autoIndex: false },
);
schema.index({ key: 1 }, { unique: true });
schema.index({ isDemo: 1, status: 1, updatedAt: -1, _id: -1 });
export default mongoose.model("EarlyWarningAlert", schema);
