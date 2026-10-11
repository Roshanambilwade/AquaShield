import mongoose from "mongoose";
import { simulationProvenance } from "../services/simulationContext.js";
export const simulationMetadataSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ["DYNAMIC_SIMULATION"], required: true },
    runId: { type: String, required: true, maxlength: 36 },
    tick: { type: Number, required: true, min: 0, max: 24 },
    eventAt: { type: Date, required: true },
  },
  { _id: false, strict: "throw" },
);
export function addSimulationProvenance(schema) {
  schema.add({
    simulation: {
      type: simulationMetadataSchema,
      immutable: true,
      default: function () {
        return this.isNew === false ? undefined : simulationProvenance();
      },
    },
  });
  schema.pre(["updateOne", "findOneAndUpdate"], function () {
    const metadata = simulationProvenance();
    if (metadata && this.getOptions().upsert) {
      const update = this.getUpdate();
      update.$setOnInsert ||= {};
      update.$setOnInsert.simulation ||= metadata;
    }
  });
}
