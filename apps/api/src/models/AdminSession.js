import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, select: false },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: "throw", autoCreate: false, autoIndex: false },
);
schema.index({ tokenHash: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("AdminSession", schema);
