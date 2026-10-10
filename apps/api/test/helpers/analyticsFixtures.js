import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Report from "../../src/models/Report.js";
import ShortageEvent from "../../src/models/ShortageEvent.js";
import Allocation from "../../src/models/Allocation.js";
import Delivery from "../../src/models/Delivery.js";
import Tanker from "../../src/models/Tanker.js";
import EarlyWarningAlert from "../../src/models/EarlyWarningAlert.js";
// Explicit synthetic persisted fixtures, confined to the calling suite's disposable DB.
export async function analyticsFixtures(actorId, operatorId, now = new Date()) {
  const from = new Date(+now - 2 * 86400000),
    to = new Date(+now - 86400000);
  const at = (minutes) => new Date(+from + minutes * 60000),
    id = () => new mongoose.Types.ObjectId();
  const correlationId = randomUUID(),
    eventId = id(),
    secondaryId = id(),
    demoId = id();
  const reports = await Report.insertMany(
    [
      [0, "AREA_01", "VERIFIED", false],
      [60, "AREA_01", "PENDING", false],
      [120, "AREA_02", "REJECTED", false],
      [180, null, "PENDING", false],
      [1440, "AREA_01", "VERIFIED", false],
      [-1, "AREA_01", "VERIFIED", false],
      [120, "AREA_01", "VERIFIED", true],
    ].map(([time, areaId, verificationStatus, isDemo]) => ({
      reporterKeyHash: randomUUID(),
      submissionId: randomUUID(),
      location: { lat: 20.011, lng: 73.79 },
      locationSource: "LOCALITY_CENTER",
      locality: "Private synthetic household",
      areaId,
      problem: "NO_WATER",
      waterLevel: "EMPTY",
      householdSize: 4,
      verificationStatus,
      isDemo,
      description: "PRIVATE_EVIDENCE",
      createdAt: at(time),
      updatedAt: at(time),
      ...(time === 0
        ? {
            audit: [
              {
                action: "REPORT_CREATED",
                actorId,
                actorRole: "CITIZEN",
                at: at(time),
                correlationId,
                outcome: "SUCCESS",
                after: { status: "PENDING" },
              },
            ],
          }
        : {}),
    })),
  );
  await ShortageEvent.collection.insertMany([
    {
      _id: eventId,
      eventKey: randomUUID(),
      isDemo: false,
      areaId: "AREA_01",
      areaName: "Panchavati",
      status: "ACTIVE",
      severityLevel: "CRITICAL",
      reportIds: [reports[0]._id, reports[1]._id],
      eligibleReportCount: 2,
      verifiedReportCount: 1,
      calculatedAt: at(120),
    },
    {
      _id: secondaryId,
      eventKey: randomUUID(),
      isDemo: false,
      areaId: "AREA_02",
      areaName: "Nashik Road",
      status: "EMERGING",
      severityLevel: "LOW",
      reportIds: [reports[0]._id, reports[1]._id],
      eligibleReportCount: 2,
      verifiedReportCount: 1,
      calculatedAt: at(125),
    },
    {
      _id: demoId,
      eventKey: randomUUID(),
      isDemo: true,
      areaId: "AREA_01",
      areaName: "Panchavati",
      status: "ACTIVE",
      severityLevel: "HIGH",
      reportIds: [reports[6]._id],
      eligibleReportCount: 1,
      calculatedAt: at(125),
    },
  ]);
  const allocationId = id(),
    deliveredId = id();
  await Allocation.collection.insertMany([
    {
      _id: allocationId,
      createdBy: actorId,
      requestId: randomUUID(),
      eventId,
      isDemo: false,
      status: "COMPLETED",
      createdAt: at(15),
      approvedAt: at(20),
      assignedAt: at(30),
      active: false,
      audit: [
        {
          _id: id(),
          action: "ALLOCATION_APPROVED",
          actorId,
          actorRole: "ADMIN",
          at: at(20),
          correlationId,
          outcome: "SUCCESS",
          before: { status: "RECOMMENDED" },
          after: { status: "APPROVED" },
          reason: "PRIVATE_REASON",
        },
        {
          _id: id(),
          action: "OPERATION_CONFLICT",
          actorId,
          at: at(22),
          outcome: "FAILURE",
        },
      ],
    },
    {
      _id: id(),
      eventId: secondaryId,
      createdBy: actorId,
      requestId: randomUUID(),
      isDemo: false,
      status: "REJECTED",
      createdAt: at(-60),
      rejectedAt: at(40),
      active: false,
      audit: [],
    },
    {
      _id: id(),
      eventId: demoId,
      createdBy: actorId,
      requestId: randomUUID(),
      isDemo: true,
      status: "RECOMMENDED",
      createdAt: at(20),
      active: true,
      audit: [],
    },
  ]);
  const delivery = (time, litres, extra = {}) => ({
    _id: id(),
    allocationId: id(),
    eventId,
    areaId: "AREA_01",
    isDemo: false,
    status: "DELIVERED",
    otpVerified: true,
    litresDelivered: litres,
    deliveredAt: at(time),
    createdAt: at(10),
    audit: [],
    ...extra,
  });
  await Delivery.collection.insertMany([
    delivery(120, 400, {
      _id: deliveredId,
      allocationId,
      requestedAt: at(15),
      startedAt: at(60),
      audit: [
        {
          _id: id(),
          action: "DELIVERY_COMPLETED",
          actorId: operatorId,
          actorRole: "OPERATOR",
          at: at(120),
          outcome: "SUCCESS",
          correlationId,
          before: { status: "COMPLETING" },
          after: { status: "DELIVERED" },
          otpHash: "PRIVATE_OTP",
        },
        {
          _id: id(),
          action: "DELIVERY_RECOVERED",
          actorId,
          at: at(121),
          outcome: "RECOVERED",
        },
      ],
    }),
    delivery(240, 600, { requestedAt: at(180), startedAt: at(210) }),
    delivery(300, 500, { requestedAt: at(400), startedAt: at(400) }),
    delivery(360, 250),
    delivery(320, -10),
    delivery(330, 100, { otpVerified: false }),
    {
      _id: id(),
      allocationId: id(),
      eventId,
      areaId: "AREA_01",
      isDemo: false,
      status: "ARRIVED",
      createdAt: at(10),
      audit: [
        {
          _id: id(),
          action: "DELIVERY_OTP_REJECTED",
          actorId: operatorId,
          at: at(80),
          outcome: "FAILURE",
        },
      ],
    },
    delivery(150, 9000, { isDemo: true, eventId: demoId }),
  ]);
  await Tanker.collection.insertMany([
    {
      _id: id(),
      identifier: "SYNTHETIC-AVAILABLE",
      isDemo: false,
      status: "AVAILABLE",
      capacityLitres: 1000,
      availableLitres: 1000,
      observedAt: now,
      operatorId,
      audit: [],
    },
    {
      _id: id(),
      identifier: "SYNTHETIC-BUSY",
      isDemo: false,
      status: "ASSIGNED",
      activeAllocationId: allocationId,
      capacityLitres: 1000,
      availableLitres: 1000,
      observedAt: now,
      operatorId: id(),
      audit: [],
    },
    {
      _id: id(),
      identifier: "SYNTHETIC-STALE",
      isDemo: false,
      status: "AVAILABLE",
      capacityLitres: 1000,
      availableLitres: 1000,
      observedAt: at(-10000),
      operatorId: id(),
      audit: [],
    },
  ]);
  await EarlyWarningAlert.collection.insertOne({
    _id: id(),
    key: randomUUID(),
    areaId: "AREA_01",
    isDemo: false,
    status: "ACKNOWLEDGED",
    createdAt: at(40),
    result: { riskLevel: "HIGH" },
    audit: [
      {
        type: "CREATED",
        at: at(40),
        actorId,
        revision: 1,
        status: "ACTIVE",
        riskLevel: "HIGH",
        note: "PRIVATE_NOTE",
      },
      {
        type: "ACKNOWLEDGED",
        at: at(45),
        actorId,
        actorRole: "ADMIN",
        revision: 2,
        previousStatus: "ACTIVE",
        status: "ACKNOWLEDGED",
        correlationId,
        outcome: "SUCCESS",
      },
    ],
  });
  return {
    from,
    to,
    reports,
    eventId,
    allocationId,
    deliveredId,
    correlationId,
  };
}
