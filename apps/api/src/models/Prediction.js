import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    inputSource: {
      type: String,
      enum: ["REPORT_HISTORY", "SYNTHETIC_FORECAST"],
      // Legacy documents have no source field. Keep them unchanged on hydration;
      // the service's ordinary-history filter explicitly includes these records.
      default: function () {
        return this.isNew ? "REPORT_HISTORY" : undefined;
      },
      immutable: true,
    },
    areaId: { type: String, required: true },
    horizonHours: { type: Number, required: true },
    isDemo: { type: Boolean, required: true, immutable: true },
    generatedAt: { type: Date, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { strict: "throw", timestamps: true, autoCreate: false, autoIndex: false },
);
schema.index({ key: 1 }, { unique: true });
schema.index({
  isDemo: 1,
  areaId: 1,
  horizonHours: 1,
  generatedAt: -1,
  _id: -1,
});
export default mongoose.model("Prediction", schema);
