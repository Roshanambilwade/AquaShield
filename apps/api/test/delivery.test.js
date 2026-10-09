import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { parseEnv } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { validPoint, tripRoute } from "../src/services/routingService.js";
import { generateOtp, matchesOtp } from "../src/services/deliveryOtp.js";
import { serializeDelivery } from "../src/services/deliveryService.js";
import { operationalAnalytics } from "../src/services/operationalAnalytics.js";
import {
  emptyTripInput,
  completeInput,
  otpInput,
} from "../src/validation/delivery.js";
const config = parseEnv({ NODE_ENV: "test" });
test("operational fairness analytics count recorded quantities once and preserve unknown served population", () => {
  const events = [
    {
      id: "event",
      areaId: "area",
      areaName: "Panchavati",
      status: "ACTIVE",
      severityLevel: "CRITICAL",
    },
  ];
  const data = operationalAnalytics(
    events,
    {
      tankers: [{ status: "AVAILABLE" }, { status: "EN_ROUTE" }],
      deliveries: [
        {
          eventId: "event",
          areaId: "area",
          litresDelivered: 3500,
          requestedAt: new Date(0),
          deliveredAt: new Date(600000),
        },
      ],
    },
    [{ eventId: "event", status: "COMPLETED" }],
  );
  assert.equal(data.areas[0].allocations, 1);
  assert.equal(data.areas[0].deliveredLitres, 3500);
  assert.equal(data.areas[0].averageResponseMinutes, 10);
  assert.equal(data.utilizationPercent, 50);
  assert.equal(data.estimatedPeopleServed, null);
  assert.equal(data.unservedHighPriorityAreas.length, 0);
  const missing = operationalAnalytics(
    events,
    { tankers: null, deliveries: null },
    null,
  );
  assert.equal(missing.areas[0].allocations, null);
  assert.equal(missing.areas[0].deliveredLitres, null);
  assert.equal(missing.unservedHighPriorityAreas[0].deliveryRecorded, null);
});
const fixture = {
  origin: { lat: 20, lng: 73.79 },
  destination: { lat: 20.02, lng: 73.8 },
  originObservedAt: new Date(),
};
test("fallback distance and ETA use stored coordinates and documented speed", async () => {
  const route = await tripRoute(fixture, config);
  assert.equal(route.distanceMethod, "STRAIGHT_LINE");
  assert.equal(route.etaMethod, "AVERAGE_SPEED_ESTIMATE");
  assert.equal(route.averageSpeedKph, 25);
  assert.equal(route.geometry, null);
  assert.ok(route.distanceKm > 2 && route.distanceKm < 3);
  assert.ok(route.etaMinutes > 0);
  assert.match(route.note, /no live GPS/);
});
test("missing, invalid, stale and future observations leave routing unknown", async () => {
  for (const changes of [
    { destination: null },
    { destination: { lat: 91, lng: 0 } },
    { origin: null },
    { originObservedAt: null },
    { originObservedAt: new Date(0) },
    { originObservedAt: new Date(Date.now() + 60000) },
  ]) {
    const route = await tripRoute({ ...fixture, ...changes }, config);
    assert.equal(route.distanceKm, null);
    assert.equal(route.etaMinutes, null);
    assert.equal(route.geometry, null);
  }
  assert.equal(validPoint({ lat: NaN, lng: 0 }), false);
});
test("OSRM-compatible road geometry and ETA are validated and correctly labeled", async () => {
  const route = await tripRoute(
    fixture,
    { ...config, ROUTING_BASE_URL: "https://routing.test/" },
    {
      fetchRoute: async (url, options) => {
        assert.equal(url.hostname, "routing.test");
        assert.ok(options.signal instanceof AbortSignal);
        return Response.json({
          routes: [
            {
              distance: 3500,
              duration: 420,
              geometry: {
                type: "LineString",
                coordinates: [
                  [73.79, 20],
                  [73.8, 20.02],
                ],
              },
            },
          ],
        });
      },
    },
  );
  assert.equal(route.distanceMethod, "ROAD_ROUTE");
  assert.equal(route.distanceKm, 3.5);
  assert.equal(route.etaMethod, "ROUTING_SERVICE_ESTIMATE");
  assert.equal(route.etaMinutes, 7);
  assert.equal(route.geometry.coordinates.length, 2);
});
test("routing errors, invalid geometry and oversized responses keep a bounded fallback", async () => {
  for (const fetchRoute of [
    async () => {
      throw Error("secret provider detail");
    },
    async () => new Response("unavailable", { status: 503 }),
    async () =>
      Response.json({
        routes: [
          {
            distance: -1,
            duration: 0,
            geometry: { type: "LineString", coordinates: [] },
          },
        ],
      }),
    async () => new Response("x".repeat(1000001)),
  ]) {
    const route = await tripRoute(
      fixture,
      { ...config, ROUTING_BASE_URL: "https://routing.test/" },
      { fetchRoute },
    );
    assert.equal(route.routingStatus, "UNAVAILABLE_FALLBACK");
    assert.equal(route.distanceMethod, "STRAIGHT_LINE");
    assert.equal(JSON.stringify(route).includes("secret"), false);
  }
});
test("cryptographic OTP hashes are salted and bound to delivery, allocation and destination", async () => {
  const d = {
    _id: "delivery",
    allocationId: "allocation",
    eventId: "destination",
  };
  const otp = await generateOtp(d),
    another = await generateOtp(d);
  assert.match(otp.code, /^\d{6}$/);
  assert.notEqual(otp.hash, another.hash);
  assert.notEqual(otp.hash, otp.code);
  const record = { ...d, otpHash: otp.hash, otpSalt: otp.salt };
  assert.equal(await matchesOtp(otp.code, record), true);
  assert.equal(
    await matchesOtp(
      String((Number(otp.code) + 1) % 1000000).padStart(6, "0"),
      record,
    ),
    false,
  );
  for (const key of ["_id", "allocationId", "eventId"])
    assert.equal(
      await matchesOtp(otp.code, { ...record, [key]: "other" }),
      false,
    );
});
test("public delivery serialization excludes OTP hash, salt and internal issuance fields", () => {
  const record = serializeDelivery({
    _id: "id",
    otpHash: "PRIVATE",
    otpSalt: "PRIVATE",
    otpVersion: 4,
    status: "ARRIVED",
    otpVerified: false,
  });
  assert.equal(JSON.stringify(record).includes("PRIVATE"), false);
  assert.equal(record.otpVersion, undefined);
});
test("strict trip, OTP and quantity contracts reject client authority", () => {
  for (const body of [
    { operatorId: "x" },
    { status: "DELIVERED" },
    { otpVerified: true },
    { destination: { lat: 1, lng: 1 } },
  ])
    assert.equal(emptyTripInput.safeParse(body).success, false);
  for (const litresDelivered of [0, -1, 2.5, NaN, 100001, "100"])
    assert.equal(completeInput.safeParse({ litresDelivered }).success, false);
  for (const code of ["123", "abcdef", 123456])
    assert.equal(otpInput.safeParse({ code }).success, false);
});
test("trip configuration is bounded and routing URL cannot embed credentials", () => {
  for (const source of [
    { ROUTING_AVERAGE_SPEED_KPH: 0 },
    { DELIVERY_OTP_TTL_SECONDS: 0 },
    { DELIVERY_OTP_MAX_ATTEMPTS: 99 },
    { ROUTING_TIMEOUT_MS: 99999 },
    { ROUTING_BASE_URL: "https://user:password@host.test/" },
  ])
    assert.throws(() => parseEnv(source), /Invalid environment/);
});
test("all delivery endpoints require authenticated sessions and no-store", async () => {
  const app = createApp(config, { databaseStatus: async () => "connected" });
  const id = "a".repeat(24);
  for (const action of [
    "start",
    "arrive",
    "otp",
    "demo-otp",
    "verify",
    "complete",
    "recover",
  ]) {
    const r = await request(app)
      .post(`/api/deliveries/${id}/${action}`)
      .send({})
      .expect(401);
    assert.equal(r.headers["cache-control"], "no-store");
  }
  await request(app).get("/api/deliveries").expect(401);
});
