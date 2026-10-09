import { ApiError } from "../middleware/errors.js";

// One running batch and one dirty generation; callers share one promise.
// A failed batch is never marked fresh. Each drain performs at most two batches.
export class DetectionGate {
  version = 0;
  completed = -1;
  finishedAt = 0;
  pending = null;
  result = null;
  run(work, { force = false, ttl = 15000 } = {}) {
    if (force) this.version++;
    if (this.pending) return this.pending;
    if (this.completed === this.version && Date.now() - this.finishedAt < ttl)
      return Promise.resolve(this.result);
    this.pending = Promise.resolve()
      .then(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          const version = this.version;
          const result = await work();
          this.result = result;
          this.completed = version;
          this.finishedAt = Date.now();
          if (this.version === version) return result;
        }
        throw new ApiError(
          503,
          "DETECTION_BUSY",
          "Evidence changed during detection. Please retry shortly.",
        );
      })
      .catch((error) => {
        this.finishedAt = 0;
        throw error;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }
}
