import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShortageEvent",
      required: true,
    },
    demandLitres: { type: Number, min: 1, max: 10000000, default: null },
    recentDeliveredLitres: {
      type: Number,
      min: 0,
      max: 10000000,
      default: null,
    },
    source: { type: String, required: true, maxlength: 500 },
    observedAt: { type: Date, required: true },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDemo: { type: Boolean, required: true },
    seedOwner: { type: String, default: null },
    audit: [
      {
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: Date,
        demandLitres: Number,
        recentDeliveredLitres: Number,
        source: String,
      },
    ],
  },
  { timestamps: true, strict: "throw", autoCreate: false, autoIndex: false },
);
schema.index({ eventId: 1 }, { unique: true });
export default mongoose.model("AllocationEvidence", schema);
