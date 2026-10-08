import mongoose from "mongoose";

const coordinates = {
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
};
const schema = new mongoose.Schema(
  {
    _id: String,
    name: { type: String, required: true },
    center: coordinates,
    populationEstimate: { type: Number, min: 1, default: null },
    averageHouseholdSize: { type: Number, min: 1, default: null },
    vulnerablePopulationEstimate: { type: Number, min: 0, default: null },
    reportCoverageEstimate: { type: Number, min: 0.001, max: 1, default: null },
    temperatureC: { type: Number, default: null },
    infrastructureIncident: {
      location: coordinates,
      startedAt: Date,
      endedAt: Date,
      description: String,
    },
    isDemo: { type: Boolean, required: true },
  },
  { timestamps: true, strict: "throw", autoCreate: false, autoIndex: false },
);
export default mongoose.model("Area", schema);
