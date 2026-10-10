import { initialWindow } from "../lib/historyWindow.js";
export default function HistoryFilters({ values, setValues }) {
  return (
    <>
      <label>
        From (UTC, inclusive)
        <input
          required
          type="datetime-local"
          value={values.from}
          onChange={(e) => setValues({ ...values, from: e.target.value })}
        />
      </label>
      <label>
        To (UTC, exclusive)
        <input
          required
          type="datetime-local"
          value={values.to}
          onChange={(e) => setValues({ ...values, to: e.target.value })}
        />
      </label>
      <label>
        Quick range
        <select
          defaultValue="7"
          onChange={(e) =>
            setValues({ ...values, ...initialWindow(Number(e.target.value)) })
          }
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </label>
    </>
  );
}
