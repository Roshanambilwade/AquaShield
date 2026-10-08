import mongoose from "mongoose";
import {
  PROBLEM_OPTIONS,
  WATER_LEVEL_OPTIONS,
} from "../../../../packages/shared/reportOptions.js";

const photoSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, enum: ["image/jpeg"], required: true },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema(
  {
    reporterKeyHash: { type: String, required: true, select: false },
    submissionId: { type: String, required: true, select: false },
    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },
    locationSource: {
      type: String,
      required: true,
      enum: ["DEVICE", "MANUAL", "LOCALITY_CENTER"],
    },
    accuracyMeters: { type: Number, min: 0, default: null },
    areaId: { type: String, default: null },
    locality: {
      type: String,
      trim: true,
      required: true,
      minlength: 2,
      maxlength: 120,
    },
    problem: {
      type: String,
      required: true,
      enum: PROBLEM_OPTIONS.map((option) => option.value),
    },
    lastSupplyTime: { type: Date, default: null },
    reportedDurationHours: { type: Number, min: 0, max: 8760, default: null },
    waterLevel: {
      type: String,
      required: true,
      enum: WATER_LEVEL_OPTIONS.map((option) => option.value),
    },
    householdSize: {
      type: Number,
      min: 1,
      max: 100,
      required: true,
      validate: Number.isInteger,
    },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    verificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
      immutable: true,
    },
    verificationSource: { type: String, default: null },
    isDemo: { type: Boolean, default: false, immutable: true },
    hasPhoto: { type: Boolean, default: false },
    photo: { type: photoSchema, select: false },
  },
  { timestamps: true, strict: "throw", autoCreate: false, autoIndex: false },
);

reportSchema.index({ reporterKeyHash: 1, submissionId: 1 }, { unique: true });
reportSchema.index({ reporterKeyHash: 1, createdAt: -1, _id: -1 });
reportSchema.index({ isDemo: 1, createdAt: -1, _id: -1 });

const Report = mongoose.model("Report", reportSchema);
const initializedDatabases = new WeakMap();

// With buffering disabled, create indexes only after a live connection exists.
export function initializeReportStorage() {
  const database = Report.db.db;
  if (!database) return Promise.reject(new Error("MongoDB is not connected."));
  if (!initializedDatabases.has(database)) {
    initializedDatabases.set(
      database,
      Report.createIndexes().catch((error) => {
        initializedDatabases.delete(database);
        throw error;
      }),
    );
  }
  return initializedDatabases.get(database);
}

export default Report;
