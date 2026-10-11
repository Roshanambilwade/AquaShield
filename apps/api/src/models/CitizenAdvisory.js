import mongoose from "mongoose";
import { auditSchema, protectAuditTrail } from "./auditTrail.js";
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    areaId: { type: String, default: null },
    areaName: { type: String, required: true },
    audience: { type: String, enum: ["AREA", "MUNICIPAL"], required: true },
    category: {
      type: String,
      enum: [
        "SUPPLY_REVIEW",
        "DELIVERY_RECORDED",
        "ACTIVITY_WATCH",
        "DEMONSTRATION",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    sourceType: { type: String, required: true },
    sourceId: { type: String, required: true },
    provenance: { type: String, required: true },
    isDemo: { type: Boolean, required: true, immutable: true },
    status: { type: String, enum: ["ACTIVE", "WITHDRAWN"], default: "ACTIVE" },
    expiresAt: { type: Date, required: true },
    revision: { type: Number, default: 1 },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    audit: [auditSchema()],
  },
  { strict: "throw", timestamps: true, autoCreate: false, autoIndex: false },
);
schema.index({ key: 1 }, { unique: true });
schema.index({ isDemo: 1, areaId: 1, createdAt: -1, _id: -1 });
protectAuditTrail(schema);
export default mongoose.model("CitizenAdvisory", schema);
