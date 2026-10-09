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
            ? report.isDemo
              ? "Verified (simulated)"
              : "Verified"
            : report.verificationStatus === "REJECTED"
              ? "Rejected"
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
      {report.responseStatus && (
        <section className="demo-note" aria-label="Municipal response status">
          <h2>Municipal response</h2>
          <p>
            {report.responseStatus.status === "ASSIGNED"
              ? "Tanker assigned to the shortage area"
              : report.responseStatus.status === "EN_ROUTE"
                ? "Tanker en route to the shortage area"
                : report.responseStatus.status === "ARRIVED"
                  ? "Tanker arrived at the shortage area"
                  : report.responseStatus.status === "DELIVERED"
                    ? "Water delivery recorded for the shortage area"
                    : report.responseStatus.status === "UNKNOWN"
                      ? "Municipal response status unavailable"
                      : "Allocation approved; assignment pending"}
          </p>
          {report.responseStatus.deliveredAt && (
            <p>
              Area delivery recorded{" "}
              {new Date(report.responseStatus.deliveredAt).toLocaleString()}
              {report.isDemo ? " (simulated demo)" : ""}.
            </p>
          )}
          <p>
            This is an area response. Delivery to your household has not been
            verified.
          </p>
        </section>
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
              ? report.isDemo
                ? "Simulated field verification"
                : "Report verified"
              : "Verification pending"}
          </strong>
          <span>
            {report.responseStatus
              ? "See the recorded municipal response above. Assignment does not verify this report or delivery."
              : report.shortageEvent
                ? "Local evidence has been analyzed. No approved or assigned response is recorded."
                : "No public local evidence is available; small household clusters are withheld for privacy."}
          </span>
        </li>
      </ol>
    </>
  );
}
