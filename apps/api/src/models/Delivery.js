import mongoose from "mongoose";
const ref = (name) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: name,
  required: true,
});
const point = new mongoose.Schema({ lat: Number, lng: Number }, { _id: false });
const schema = new mongoose.Schema(
  {
    allocationId: ref("Allocation"),
    eventId: ref("ShortageEvent"),
    tankerId: ref("Tanker"),
    operatorId: ref("User"),
    areaId: { type: String, default: null },
    areaName: { type: String, required: true },
    destination: { type: point, default: null },
    origin: { type: point, default: null },
    originObservedAt: { type: Date, default: null },
    isDemo: { type: Boolean, required: true },
    status: {
      type: String,
      enum: [
        "ASSIGNED",
        "EN_ROUTE",
        "ARRIVED",
        "COMPLETING",
        "DELIVERED",
        "RESETTING",
      ],
      required: true,
    },
    plannedLitres: { type: Number, default: null, min: 1 },
    capacityLitres: { type: Number, required: true, min: 1 },
    startingAvailableLitres: { type: Number, required: true, min: 1 },
    litresDelivered: { type: Number, default: null, min: 1 },
    requestedAt: Date,
    assignedAt: Date,
    startedAt: Date,
    arrivedAt: Date,
    deliveredAt: Date,
    completionActorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    otpVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    verificationMethod: {
      type: String,
      enum: ["DEMO_OTP", "RECIPIENT_OTP"],
      default: null,
    },
    otpHash: { type: String, select: false },
    otpSalt: { type: String, select: false },
    otpVersion: { type: Number, default: 0 },
    otpIssuedAt: Date,
    otpExpiresAt: Date,
    otpNextIssueAt: Date,
    otpAttempts: { type: Number, default: 0 },
    syncPending: { type: Boolean, default: false },
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
schema.index(
  { allocationId: 1 },
  {
    unique: true,
    partialFilterExpression: { allocationId: { $type: "objectId" } },
  },
);
schema.index({ operatorId: 1, createdAt: -1 });
schema.index({ isDemo: 1, status: 1, deliveredAt: -1 });
export default mongoose.model("Delivery", schema);
