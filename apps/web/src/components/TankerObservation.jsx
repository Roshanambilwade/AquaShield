import { useState } from "react";
export default function TankerObservation({ tanker, busy, mutate }) {
  const [assessment, setAssessment] = useState(""),
    [litres, setLitres] = useState(tanker.availableLitres ?? ""),
    [confirmed, setConfirmed] = useState(false);
  const locked =
    tanker.activeAllocationId ||
    !["AVAILABLE", "UNAVAILABLE"].includes(tanker.status);
  return (
    <details>
      <summary>Record simulated present-time observation</summary>
      <p>
        This records a new authorized simulated assessment using server time.
        Historical observations remain preserved. Reserved tankers and active
        trips cannot be edited.
      </p>
      <label>
        Observed available litres
        <input
          type="number"
          min="0"
          max={tanker.capacityLitres}
          value={litres}
          onChange={(e) => setLitres(e.target.value)}
        />
      </label>
      <label>
        Simulated inspection note
        <textarea
          minLength={10}
          maxLength={500}
          value={assessment}
          onChange={(e) => setAssessment(e.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{" "}
        I assessed this simulated present state and authorize its recording.
      </label>
      <button
        disabled={
          busy ||
          locked ||
          !confirmed ||
          assessment.trim().length < 10 ||
          litres === ""
        }
        onClick={async () => {
          const result = await mutate(
            `tankers/${tanker.id}/observation`,
            {
              revision: tanker.revision,
              availableLitres: Number(litres),
              status: tanker.status,
              currentLocation: tanker.currentLocation,
              assessment,
              confirmSimulated: true,
            },
            "New simulated tanker observation recorded; eligibility rechecked.",
          );
          if (result) {
            setConfirmed(false);
            setAssessment("");
          }
        }}
      >
        Save simulated observation
      </button>
    </details>
  );
}
