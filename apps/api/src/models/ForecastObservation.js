import { addSimulationProvenance } from "./simulationProvenance.js";
import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    batch: { type: String, required: true },
    scenarioEnd: { type: Date, required: true },
    areaId: { type: String, required: true },
    observedAt: { type: Date, required: true },
    reporterKey: { type: String, required: true },
    location: { lat: Number, lng: Number },
    provenance: {
      type: String,
      enum: ["SYNTHETIC_FORECAST_OBSERVATION"],
      required: true,
    },
  },
  { strict: "throw", timestamps: true, autoCreate: false, autoIndex: false },
);
schema.index({ key: 1 }, { unique: true });
schema.index({ scenarioEnd: -1, batch: 1, areaId: 1 });
addSimulationProvenance(schema);
export default mongoose.model("ForecastObservation", schema);
