import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { reportInputSchema, validate } from "../src/validation/report.js";
import { processPhoto } from "../src/services/photoService.js";
import { createSubmissionLimiter } from "../src/middleware/submissionLimit.js";

const validReport = () => ({
  submissionId: randomUUID(),
  location: { lat: 20.011, lng: 73.79 },
  locationSource: "MANUAL",
  locality: "Panchavati",
  problem: "NO_WATER",
  waterLevel: "UNKNOWN",
  householdSize: 5,
});

test("submission rate limit returns retry guidance and expires", () => {
  let time = 1000;
  const limit = createSubmissionLimiter({
    max: 2,
    windowMs: 1000,
    now: () => time,
  });
  const headers = {};
  const req = { ip: "127.0.0.1" };
  const res = {
    set: (name, value) => {
      headers[name] = value;
    },
  };
  let error;
  const next = (value) => {
    error = value;
  };
  limit(req, res, next);
  limit(req, res, next);
  assert.equal(error, undefined);
  limit(req, res, next);
  assert.equal(error.code, "RATE_LIMITED");
  assert.equal(headers["Retry-After"], "1");
  time += 1000;
  limit(req, res, next);
  assert.equal(error, undefined);
});

test("unknown time and duration stay null; household size is not population", () => {
  const input = validate(reportInputSchema, validReport());
  assert.equal(input.lastSupplyTime, null);
  assert.equal(input.reportedDurationHours, null);
  assert.equal(input.householdSize, 5);
  assert.equal(input.estimatedAffectedPopulation, undefined);
});

for (const [name, update] of [
  ["latitude", { location: { lat: 91, lng: 73 } }],
  ["longitude", { location: { lat: 20, lng: -181 } }],
  ["missing coordinates", { location: {} }],
  ["numeric strings", { householdSize: "5" }],
  ["zero household", { householdSize: 0 }],
  ["fractional household", { householdSize: 2.5 }],
  ["problem enum", { problem: "FAKE" }],
  ["water enum", { waterLevel: "FAKE" }],
  [
    "future time",
    { lastSupplyTime: new Date(Date.now() + 3600000).toISOString() },
  ],
  ["bad time", { lastSupplyTime: "not a date" }],
  ["negative duration", { reportedDurationHours: -1 }],
  ["empty locality", { locality: " " }],
  ["description length", { description: "x".repeat(2001) }],
  ["invented population", { estimatedAffectedPopulation: 620 }],
  ["client verification", { verificationStatus: "VERIFIED" }],
  ["client demo flag", { isDemo: true }],
  ["operator injection", { location: { lat: { $gt: 0 }, lng: 73 } }],
  ["SVG photo", { photo: "data:image/svg+xml;base64,PHN2Zz4=" }],
]) {
  test(`rejects invalid report: ${name}`, () =>
    assert.throws(
      () => validate(reportInputSchema, { ...validReport(), ...update }),
      (error) => error.status === 422 && error.code === "VALIDATION_ERROR",
    ));
}

test("zero duration and legitimate coordinate boundaries remain valid", () => {
  const input = validate(reportInputSchema, {
    ...validReport(),
    location: { lat: 0, lng: 0 },
    reportedDurationHours: 0,
    locality: "  Test locality  ",
  });
  assert.deepEqual(input.location, { lat: 0, lng: 0 });
  assert.equal(input.reportedDurationHours, 0);
  assert.equal(input.locality, "Test locality");
});

test("photo processing validates, resizes, and removes EXIF metadata", async () => {
  const raw = await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: "#0c5555" },
  })
    .withMetadata()
    .jpeg()
    .toBuffer();
  const photo = await processPhoto(
    `data:image/jpeg;base64,${raw.toString("base64")}`,
  );
  const metadata = await sharp(photo.data).metadata();
  assert.equal(photo.contentType, "image/jpeg");
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.exif, undefined);
});

test("spoofed and corrupt images are rejected", async () => {
  await assert.rejects(
    processPhoto("data:image/png;base64,aGVsbG8="),
    (error) => error.code === "INVALID_PHOTO",
  );
  const jpg = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "red" },
  })
    .jpeg()
    .toBuffer();
  await assert.rejects(
    processPhoto(`data:image/png;base64,${jpg.toString("base64")}`),
    (error) => error.code === "INVALID_PHOTO",
  );
});
