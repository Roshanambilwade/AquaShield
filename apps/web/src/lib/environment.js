import { createContext, useContext } from "react";
import { LOCALITY_CENTERS } from "../../../../packages/shared/reportOptions.js";
export const EnvironmentContext = createContext({
  demonstration: false,
  areas: LOCALITY_CENTERS,
});
export const useEnvironment = () => useContext(EnvironmentContext);
