import {
  PROBLEM_OPTIONS,
  WATER_LEVEL_OPTIONS,
  optionLabel,
} from "../../../../packages/shared/reportOptions.js";
import ShortageDetails from "./ShortageDetails.jsx";

const locationLabels = {
  DEVICE: "Device location",
  MANUAL: "Citizen-entered coordinates",
  LOCALITY_CENTER: "Approximate locality center",
};

export default function ReportDetails({ report }) {
  return (
    <>
      {report.isDemo && (
        <p className="demo-note">
          Simulated demo report. The location, household details, and supply
          history are fictional.
        </p>
      )}
      <div className="report-status" role="status">
        <span className="status-badge degraded">
          {report.verificationStatus === "VERIFIED"
            ? "Verified (simulated)"
            : "Pending verification"}
        </span>
        <p>
          Your report is saved. Local shortage evidence is calculated separately
          from field verification.
        </p>
      </div>
      {report.detectionStatus === "DEFERRED" && (
        <p className="missing-evidence">
          Your report is saved. Shortage analysis is temporarily unavailable;
          refresh to retry.
        </p>
      )}
      {report.shortageEvent && (
        <ShortageDetails event={report.shortageEvent} compact />
      )}
      <dl className="report-details">
        <div>
          <dt>Report ID</dt>
          <dd className="report-id">{report.id}</dd>
        </div>
        <div>
          <dt>Area / locality</dt>
          <dd>{report.locality}</dd>
        </div>
        <div>
          <dt>Problem</dt>
          <dd>{optionLabel(PROBLEM_OPTIONS, report.problem)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {report.location.lat}, {report.location.lng}
            <small>
              {locationLabels[report.locationSource]}
              {report.accuracyMeters != null
                ? ` · Device-reported accuracy: approximately ${Math.round(report.accuracyMeters)} m`
                : ""}
            </small>
          </dd>
        </div>
        <div>
          <dt>Last water supply</dt>
          <dd>
            {report.lastSupplyTime
              ? new Date(report.lastSupplyTime).toLocaleString()
              : "Not known"}
          </dd>
        </div>
        <div>
          <dt>Reported duration</dt>
          <dd>
            {report.reportedDurationHours != null
              ? `Approximately ${report.reportedDurationHours} hours`
              : "Not known"}
          </dd>
        </div>
        <div>
          <dt>Household water level</dt>
          <dd>{optionLabel(WATER_LEVEL_OPTIONS, report.waterLevel)}</dd>
        </div>
        <div>
          <dt>Household size</dt>
          <dd>
            {report.householdSize}{" "}
            {report.householdSize === 1 ? "person" : "people"} ·
            citizen-provided
          </dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{new Date(report.createdAt).toLocaleString()}</dd>
        </div>
      </dl>
      {report.description && (
        <section className="report-description">
          <h2>Description</h2>
          <p>{report.description}</p>
        </section>
      )}
      {report.photo && (
        <figure className="report-photo">
          <img
            src={report.photo}
            alt="Photo supplied with this water problem report"
          />
          <figcaption>Citizen-supplied photo</figcaption>
        </figure>
      )}
      <ol className="report-timeline" aria-label="Report progress">
        <li>
          <strong>Report submitted</strong>
          <span>Saved in AquaShield.</span>
        </li>
        <li>
          <strong>
            {report.verificationStatus === "VERIFIED"
              ? "Simulated field verification"
              : "Verification pending"}
          </strong>
          <span>
            {report.shortageEvent
              ? "Local evidence has been analyzed. No emergency response is assigned."
              : "No local event analysis or emergency response is available yet."}
          </span>
        </li>
      </ol>
    </>
  );
}
