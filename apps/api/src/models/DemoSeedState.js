import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    _id: String,
    anchoredAt: { type: Date, required: true },
    tankerIds: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { strict: "throw", autoCreate: false, autoIndex: false },
);
export default mongoose.model("DemoSeedState", schema);
