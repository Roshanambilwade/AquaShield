import mongoose from "mongoose";

const state = new mongoose.Schema(
  {
    status: String,
    balanceLitres: Number,
    otpVerified: Boolean,
    riskLevel: String,
  },
  { _id: false, strict: "throw" },
);
export const auditFields = {
  actorRole: { type: String, enum: ["ADMIN", "OPERATOR", "CITIZEN"] },
  correlationId: { type: String, match: /^[a-f0-9-]{36}$/i },
  outcome: {
    type: String,
    enum: ["SUCCESS", "FAILURE", "PENDING", "RECOVERED", null],
  },
  before: state,
  after: state,
};
export function auditSchema(extras = {}) {
  return new mongoose.Schema(
    {
      action: String,
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      at: Date,
      ...auditFields,
      ...extras,
    },
    { strict: "throw" },
  );
}
export function assertAppendOnlyUpdate(update) {
  if (Array.isArray(update))
    throw new Error("Audit history cannot be replaced by an update pipeline.");
  for (const [operator, fields] of Object.entries(update || {})) {
    for (const [path, value] of Object.entries(
      fields && typeof fields === "object" ? fields : {},
    )) {
      if (path === "audit" || path.startsWith("audit.")) {
        if (operator === "$setOnInsert" && path === "audit") continue;
        if (operator !== "$push" || path !== "audit")
          throw new Error("Audit history is append-only.");
        if (
          value &&
          typeof value === "object" &&
          ["$slice", "$sort", "$position"].some((key) => key in value)
        )
          throw new Error("Audit history cannot be trimmed or reordered.");
      }
      if (
        operator === "$rename" &&
        (value === "audit" || String(value).startsWith("audit."))
      )
        throw new Error("Audit history cannot be renamed.");
    }
    if (!operator.startsWith("$") && operator === "audit")
      throw new Error("Audit history is append-only.");
  }
}
export function protectAuditTrail(schema, actionField = "action") {
  schema.index({ isDemo: 1, "audit.at": -1 });
  schema.index({ isDemo: 1, "audit.actorId": 1, "audit.at": -1 });
  schema.index({ isDemo: 1, "audit.correlationId": 1, "audit.at": -1 });
  schema.index({ isDemo: 1, [`audit.${actionField}`]: 1, "audit.at": -1 });
  schema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
    assertAppendOnlyUpdate(this.getUpdate());
  });
  schema.pre(["replaceOne", "findOneAndReplace"], function () {
    throw new Error("Audited entities cannot be replaced.");
  });
  schema.pre(
    ["deleteOne", "deleteMany", "findOneAndDelete"],
    async function () {
      // Explicit fictional-demo purges retain the existing restricted reset policy.
      if (this.getFilter().isDemo === true) return;
      if (
        await this.model.exists({
          $and: [
            this.getFilter(),
            { isDemo: { $ne: true }, "audit.0": { $exists: true } },
          ],
        })
      )
        throw new Error("Operational audit history cannot be deleted.");
    },
  );
  schema.pre("save", function () {
    if (!this.isNew && this.isModified("audit"))
      throw new Error("Use atomic append-only audit updates.");
  });
}
