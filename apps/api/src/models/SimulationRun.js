import mongoose from "mongoose";
import { auditSchema, protectAuditTrail } from "./auditTrail.js";
const schema = new mongoose.Schema(
  {
    _id: { type: String, default: "municipal-v1" },
    runId: { type: String, required: true },
    scenario: { type: String, enum: ["municipal-v1"], default: "municipal-v1" },
    databaseName: { type: String, required: true },
    prepared: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["READY", "RUNNING", "PAUSED", "FAILED", "STOPPED"],
      default: "READY",
    },
    tick: { type: Number, default: 0, min: 0, max: 24 },
    anchorAt: { type: Date, required: true },
    simulatedAt: { type: Date, required: true },
    speed: { type: Number, default: 1, enum: [1, 2, 3] },
    inFlight: { type: Boolean, default: false },
    pendingAt: { type: Date, default: null },
    errorCode: { type: String, default: null },
    commandCount: { type: Number, default: 0, max: 250 },
    failedTicks: { type: [Number], default: [] },
    isDemo: { type: Boolean, default: true, immutable: true },
    audit: {
      type: [auditSchema({ tick: Number, simulationAt: Date })],
      default: [],
    },
  },
  { timestamps: true, strict: "throw", autoCreate: false, autoIndex: false },
);
protectAuditTrail(schema);
export default mongoose.model("SimulationRun", schema);
