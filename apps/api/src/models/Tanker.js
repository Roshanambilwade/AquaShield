import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    capacityLitres: { type: Number, required: true, min: 1, max: 100000 },
    availableLitres: { type: Number, default: null, min: 0, max: 100000 },
    status: {
      type: String,
      enum: ["AVAILABLE", "ASSIGNED", "EN_ROUTE", "ARRIVED", "UNAVAILABLE"],
      default: "UNAVAILABLE",
    },
    currentLocation: {
      type: new mongoose.Schema(
        {
          lat: { type: Number, required: true, min: -90, max: 90 },
          lng: { type: Number, required: true, min: -180, max: 180 },
        },
        { _id: false },
      ),
      default: null,
    },
    observedAt: { type: Date, default: null },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    activeAllocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Allocation",
      default: null,
    },
    isDemo: { type: Boolean, required: true },
    seedOwner: { type: String, default: null },
    revision: { type: Number, default: 0 },
    audit: [
      {
        action: String,
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: Date,
      },
    ],
  },
  { timestamps: true, strict: "throw", autoCreate: false, autoIndex: false },
);
schema.index({ identifier: 1 }, { unique: true });
schema.index(
  { operatorId: 1 },
  {
    unique: true,
    partialFilterExpression: { operatorId: { $type: "objectId" } },
  },
);
schema.pre("validate", function () {
  if (
    this.availableLitres != null &&
    this.availableLitres > this.capacityLitres
  )
    this.invalidate("availableLitres", "Available water exceeds capacity.");
});
export default mongoose.model("Tanker", schema);
