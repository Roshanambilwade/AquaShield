import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    advisoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
    readAt: { type: Date, default: null },
  },
  { strict: "throw", timestamps: true, autoCreate: false, autoIndex: false },
);
schema.index({ userId: 1, advisoryId: 1 }, { unique: true });
export default mongoose.model("AdvisoryReadState", schema);
