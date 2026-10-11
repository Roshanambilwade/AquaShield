import { AsyncLocalStorage } from "node:async_hooks";
export const simulationContext = new AsyncLocalStorage();
export function simulationProvenance() {
  const context = simulationContext.getStore();
  return context
    ? {
        source: "DYNAMIC_SIMULATION",
        runId: context.runId,
        tick: context.tick,
        eventAt: context.eventAt,
      }
    : undefined;
}
