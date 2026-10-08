export const PROBLEM_OPTIONS = [
  { value: "NO_WATER", label: "No water" },
  { value: "LOW_PRESSURE", label: "Low pressure" },
  { value: "PIPELINE_FAILURE", label: "Pipeline failure" },
  { value: "TANK_EMPTY", label: "Tank empty" },
  { value: "WATER_QUALITY", label: "Water quality concern" },
  { value: "OTHER", label: "Other water problem" },
];

export const WATER_LEVEL_OPTIONS = [
  { value: "EMPTY", label: "Empty" },
  { value: "LESS_THAN_25", label: "Less than 25%" },
  { value: "BETWEEN_25_50", label: "Between 25% and 50%" },
  { value: "ABOVE_50", label: "Above 50%" },
  { value: "UNKNOWN", label: "Not sure" },
];

// Locality center from the specification. It is not a household's exact location.
export const LOCALITY_CENTERS = [
  { id: "AREA_01", name: "Panchavati", lat: 20.011, lng: 73.79 },
];

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}
