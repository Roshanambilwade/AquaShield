import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, maxlength: 120 },
    role: {
      type: String,
      enum: ["ADMIN", "CITIZEN", "OPERATOR"],
      required: true,
    },
    passwordHash: { type: String, required: true, select: false },
    disabled: { type: Boolean, default: false },
  },
  { timestamps: true, strict: "throw", autoCreate: false, autoIndex: false },
);
schema.index({ email: 1 }, { unique: true });
export default mongoose.model("User", schema);
