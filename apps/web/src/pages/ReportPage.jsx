import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PROBLEM_OPTIONS,
  WATER_LEVEL_OPTIONS,
  MAX_PHOTO_BYTES,
} from "../../../../packages/shared/reportOptions.js";
import { submitReport } from "../lib/api.js";
import CitizenAccess from "../components/CitizenAccess.jsx";
import { useEnvironment } from "../lib/environment.js";

const initial = {
  locality: "",
  areaId: null,
  lat: "",
  lng: "",
  locationSource: "MANUAL",
  accuracyMeters: null,
  problem: "",
  lastSupplyTime: "",
  reportedDurationHours: "",
  waterLevel: "UNKNOWN",
  householdSize: "",
  description: "",
};

function localDateTime(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function ReportPage() {
  return (
    <CitizenAccess>
      <ReportForm />
    </CitizenAccess>
  );
}
function ReportForm() {
  const LOCALITY_CENTERS = useEnvironment().areas;
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [photo, setPhoto] = useState(undefined);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [fields, setFields] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionId = useRef(crypto.randomUUID());
  const photoAttempt = useRef(0);
  const locationAttempt = useRef(0);
  const busy = submitting || photoLoading || locating;

  function change(name, value) {
    submissionId.current = crypto.randomUUID();
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "locality" ? { areaId: null } : {}),
      ...(["lat", "lng"].includes(name)
        ? { locationSource: "MANUAL", accuracyMeters: null }
        : {}),
    }));
    setFields((previous) => ({
      ...previous,
      [name]: "",
      [`location.${name}`]: "",
    }));
  }

  function selectCenter(id) {
    const center = LOCALITY_CENTERS.find((value) => value.id === id);
    if (!center) return;
    locationAttempt.current += 1;
    submissionId.current = crypto.randomUUID();
    setForm((previous) => ({
      ...previous,
      locality: center.name,
      areaId: center.id,
      lat: String(center.lat),
      lng: String(center.lng),
      locationSource: "LOCALITY_CENTER",
      accuracyMeters: null,
    }));
    setLocationMessage(
      "Using the approximate locality center. You can replace these coordinates with your location.",
    );
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Location capture is unavailable. Choose a locality center or enter coordinates.",
      );
      return;
    }
    const attempt = ++locationAttempt.current;
    setLocating(true);
    setLocationMessage("Requesting device location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (attempt !== locationAttempt.current) return;
        submissionId.current = crypto.randomUUID();
        setForm((previous) => ({
          ...previous,
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
          locationSource: "DEVICE",
          accuracyMeters: position.coords.accuracy,
        }));
        setLocating(false);
        setLocationMessage(
          `Location captured. Device-reported accuracy is approximately ${Math.round(position.coords.accuracy)} m.`,
        );
      },
      (locationError) => {
        if (attempt !== locationAttempt.current) return;
        setLocating(false);
        setLocationMessage(
          locationError.code === 1
            ? "Location permission was denied. Choose a locality center or enter coordinates instead."
            : "Could not capture your location. Choose a locality center or enter coordinates instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function choosePhoto(event) {
    const file = event.target.files?.[0];
    const attempt = ++photoAttempt.current;
    setPhoto(undefined);
    setPhotoLoading(false);
    setFields((previous) => ({ ...previous, photo: "" }));
    submissionId.current = crypto.randomUUID();
    if (!file) return;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > MAX_PHOTO_BYTES
    ) {
      setFields((previous) => ({
        ...previous,
        photo: "Choose a JPEG or PNG photo up to 2 MB.",
      }));
      event.target.value = "";
      return;
    }
    setPhotoLoading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(
            new Error("Could not read the photo. Please select it again."),
          );
        reader.readAsDataURL(file);
      });
      if (attempt === photoAttempt.current) setPhoto(dataUrl);
    } catch (photoError) {
      if (attempt === photoAttempt.current)
        setFields((previous) => ({ ...previous, photo: photoError.message }));
    } finally {
      if (attempt === photoAttempt.current) setPhotoLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const errors = {};
    if (
      form.lat === "" ||
      !Number.isFinite(Number(form.lat)) ||
      Number(form.lat) < -90 ||
      Number(form.lat) > 90
    )
      errors["location.lat"] = "Enter a latitude between -90 and 90.";
    if (
      form.lng === "" ||
      !Number.isFinite(Number(form.lng)) ||
      Number(form.lng) < -180 ||
      Number(form.lng) > 180
    )
      errors["location.lng"] = "Enter a longitude between -180 and 180.";
    if (form.locality.trim().length < 2)
      errors.locality = "Enter an area or locality.";
    if (!form.problem)
      errors.problem = "Choose the problem you are experiencing.";
    const size = Number(form.householdSize);
    if (!Number.isInteger(size) || size < 1 || size > 100)
      errors.householdSize = "Enter a household size from 1 to 100.";
    const lastSupply = form.lastSupplyTime
      ? new Date(form.lastSupplyTime)
      : null;
    if (
      lastSupply &&
      (!Number.isFinite(lastSupply.getTime()) ||
        lastSupply.getTime() > Date.now())
    )
      errors.lastSupplyTime = "Last supply time cannot be in the future.";
    const duration =
      form.reportedDurationHours === ""
        ? null
        : Number(form.reportedDurationHours);
    if (
      duration != null &&
      (!Number.isFinite(duration) || duration < 0 || duration > 8760)
    )
      errors.reportedDurationHours =
        "Enter a duration between 0 and 8760 hours, or leave it unknown.";
    if (Object.keys(errors).length) {
      setFields(errors);
      setError("Please check the highlighted fields.");
      return;
    }
    setFields({});
    setError("");
    setSubmitting(true);
    try {
      const report = await submitReport({
        submissionId: submissionId.current,
        locality: form.locality.trim(),
        areaId: form.areaId,
        location: { lat: Number(form.lat), lng: Number(form.lng) },
        locationSource: form.locationSource,
        accuracyMeters: form.accuracyMeters,
        problem: form.problem,
        lastSupplyTime: lastSupply?.toISOString() || null,
        reportedDurationHours: duration,
        waterLevel: form.waterLevel,
        householdSize: size,
        description: form.description.trim(),
        ...(photo ? { photo } : {}),
      });
      navigate(`/report/success?id=${report.id}`);
    } catch (submitError) {
      setError(submitError.message);
      setFields(submitError.fields || {});
    } finally {
      setSubmitting(false);
    }
  }

  const input = (name, label, props = {}) => (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        value={form[name]}
        onChange={(event) => change(name, event.target.value)}
        aria-invalid={Boolean(fields[name] || fields[`location.${name}`])}
        aria-describedby={`${name}-error`}
        {...props}
      />
      <span className="field-error" id={`${name}-error`}>
        {fields[name] || fields[`location.${name}`]}
      </span>
    </div>
  );

  return (
    <div className="page report-page">
      <p className="eyebrow">Citizen reporting</p>
      <h1 className="page-title">Report a water problem.</h1>
      <p className="page-intro">
        Tell us what your household is experiencing. If you do not know a supply
        time, duration, or water level, you can leave it unknown.
      </p>
      <form
        onSubmit={submit}
        noValidate
        aria-label="Water problem report"
        aria-busy={submitting}
      >
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={submitting}>
          <legend>1. Where is the problem?</legend>
          <div className="location-tools">
            <button
              type="button"
              className="button button-secondary"
              onClick={captureLocation}
              disabled={locating}
            >
              {locating ? "Locating…" : "Use current location"}
            </button>
            <div className="form-field">
              <label htmlFor="locality-center">
                Or choose a locality center
              </label>
              <select
                id="locality-center"
                defaultValue=""
                onChange={(event) => selectCenter(event.target.value)}
                disabled={locating}
              >
                <option value="">Select an approximate center</option>
                {LOCALITY_CENTERS.map((center) => (
                  <option value={center.id} key={center.id}>
                    {center.name} — approximate center
                  </option>
                ))}
              </select>
            </div>
          </div>
          {locationMessage && (
            <p className="form-hint" role="status">
              {locationMessage}
            </p>
          )}
          <div className="form-grid">
            {input("lat", "Latitude", {
              type: "number",
              step: "any",
              min: -90,
              max: 90,
              required: true,
              disabled: locating,
            })}
            {input("lng", "Longitude", {
              type: "number",
              step: "any",
              min: -180,
              max: 180,
              required: true,
              disabled: locating,
            })}
          </div>
          <p className="form-hint">
            You can enter coordinates manually. A locality center is approximate
            and does not identify your exact household location.
          </p>
          {input("locality", "Area / locality", {
            required: true,
            maxLength: 120,
            autoComplete: "address-level3",
          })}
        </fieldset>
        <fieldset disabled={submitting}>
          <legend>2. What is happening?</legend>
          <div className="form-field">
            <label htmlFor="problem">Problem type</label>
            <select
              id="problem"
              value={form.problem}
              required
              aria-invalid={Boolean(fields.problem)}
              aria-describedby="problem-error"
              onChange={(event) => change("problem", event.target.value)}
            >
              <option value="">Choose a problem</option>
              {PROBLEM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="field-error" id="problem-error">
              {fields.problem}
            </span>
          </div>
          <div className="form-grid">
            {input("lastSupplyTime", "Last water supply time (if known)", {
              type: "datetime-local",
              max: localDateTime(new Date()),
            })}
            {input(
              "reportedDurationHours",
              "Approximate shortage duration (hours)",
              {
                type: "number",
                step: "any",
                min: 0,
                max: 8760,
                placeholder: "Leave blank if unknown",
              },
            )}
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="waterLevel">Current household water level</label>
              <select
                id="waterLevel"
                value={form.waterLevel}
                onChange={(event) => change("waterLevel", event.target.value)}
              >
                {WATER_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="field-error">{fields.waterLevel}</span>
            </div>
            {input("householdSize", "How many people are in your household?", {
              type: "number",
              step: 1,
              min: 1,
              max: 100,
              required: true,
            })}
          </div>
          <p className="form-hint">
            Count only the people in your household. Wider neighborhood impact
            will be estimated by the system in a later phase.
          </p>
        </fieldset>
        <fieldset disabled={submitting}>
          <legend>
            3. Anything else? <span>Optional</span>
          </legend>
          <div className="form-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={4}
              maxLength={2000}
              value={form.description}
              onChange={(event) => change("description", event.target.value)}
              placeholder="Add anything that would help explain the problem."
            />
            <span className="field-error">{fields.description}</span>
          </div>
          <div className="form-field">
            <label htmlFor="photo">Photo (JPEG or PNG, up to 2 MB)</label>
            <input
              id="photo"
              type="file"
              accept="image/jpeg,image/png"
              onChange={choosePhoto}
              aria-describedby="photo-error"
            />
            <span className="field-error" id="photo-error">
              {fields.photo}
            </span>
          </div>
          {photoLoading && <p role="status">Reading photo…</p>}
          {photo && (
            <div className="photo-preview">
              <img src={photo} alt="Selected report photo preview" />
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setPhoto(undefined);
                  photoAttempt.current += 1;
                  submissionId.current = crypto.randomUUID();
                  document.getElementById("photo").value = "";
                }}
              >
                Remove photo
              </button>
            </div>
          )}
          <p className="form-hint">
            Avoid including faces or private documents. Uploaded photos are
            resized and stripped of metadata.
          </p>
        </fieldset>
        <p className="privacy-note">
          Your report history is saved for this browser. Clearing browser
          storage removes your access key. No name or contact details are
          required.
        </p>
        <div className="form-actions">
          <button type="submit" className="button" disabled={busy}>
            {submitting ? "Submitting report…" : "Submit report"}
          </button>
          <Link to="/my-reports">View my reports</Link>
        </div>
      </form>
    </div>
  );
}
