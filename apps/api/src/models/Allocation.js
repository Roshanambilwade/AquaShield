import mongoose from "mongoose";
import { auditSchema, protectAuditTrail } from "./auditTrail.js";
const ref = (name) => ({ type: mongoose.Schema.Types.ObjectId, ref: name });
const schema = new mongoose.Schema(
  {
    eventId: { ...ref("ShortageEvent"), required: true },
    tankerId: { ...ref("Tanker"), required: true },
    operatorId: { ...ref("User"), default: null },
    status: {
      type: String,
      enum: [
        "RECOMMENDED",
        "APPROVED",
        "ASSIGNING",
        "RECONCILING",
        "ASSIGNED",
        "COMPLETED",
        "RESETTING",
        "REJECTED",
      ],
      required: true,
    },
    active: { type: Boolean, default: true },
    isDemo: { type: Boolean, required: true },
    requestId: { type: String, required: true },
    seedKey: { type: String, default: null },
    createdBy: { ...ref("User"), required: true },
    approvedBy: ref("User"),
    approvedAt: Date,
    assignedBy: ref("User"),
    assignedAt: Date,
    rejectedBy: ref("User"),
    rejectedAt: Date,
    rejectionReason: String,
    notes: { type: String, default: "", maxlength: 1200 },
    evidence: { type: mongoose.Schema.Types.Mixed, required: true },
    recommendationEvidence: mongoose.Schema.Types.Mixed,
    approvalEvidence: mongoose.Schema.Types.Mixed,
    ai: mongoose.Schema.Types.Mixed,
    audit: [auditSchema({ reason: String })],
  },
  { timestamps: true, strict: "throw", autoCreate: false, autoIndex: false },
);
schema.index(
  { eventId: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
schema.index(
  { tankerId: 1 },
  { unique: true, partialFilterExpression: { status: "ASSIGNED" } },
);
schema.index({ createdBy: 1, requestId: 1 }, { unique: true });
schema.index({ isDemo: 1, createdAt: -1 });
schema.index({ isDemo: 1, eventId: 1, assignedAt: 1 });
for (const field of ["approvedAt", "assignedAt", "rejectedAt"])
  schema.index({ isDemo: 1, [field]: -1 });
protectAuditTrail(schema);
export default mongoose.model("Allocation", schema);
