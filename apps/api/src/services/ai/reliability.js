import { setTimeout as delay } from "node:timers/promises";
import { ApiError } from "../../middleware/errors.js";
import {
  sanitizeProviderError,
  providerRetryAfterMs,
} from "./providerErrors.js";

const instances = new WeakMap();
export function aiReliability(config) {
  if (!instances.has(config))
    instances.set(config, createAiReliability(config));
  return instances.get(config);
}
const cancelled = () =>
  new ApiError(499, "AI_CANCELLED", "The assessment was cancelled.");
const transient = (e) =>
  [
    "AI_PROVIDER_RATE_LIMITED",
    "AI_PROVIDER_UNAVAILABLE",
    "AI_TIMEOUT",
    "AI_PROVIDER_NETWORK",
  ].includes(e.code);
const unavailable = (code, category) =>
  new ApiError(
    503,
    code,
    "AI explanation is temporarily unavailable; backend evidence remains available.",
    { category },
  );

// One process-local instance per application config is shared across roles and
// allocation explanations. No queued requests; bounded active work includes backoff.
export function createAiReliability(
  config,
  {
    now = Date.now,
    random = Math.random,
    sleep = (ms, signal) => delay(ms, undefined, { signal }),
    log = (record) => console.info(JSON.stringify(record)),
  } = {},
) {
  let active = 0,
    failures = 0,
    openUntil = 0,
    cooldownUntil = 0,
    probe = false,
    epoch = 0;
  const policy = {
    retries: config.AI_MAX_RETRIES ?? 1,
    attemptMs: config.AI_ATTEMPT_TIMEOUT_MS ?? config.AI_TIMEOUT_MS,
    baseMs: config.AI_RETRY_BASE_MS ?? 500,
    maxDelayMs: config.AI_RETRY_MAX_DELAY_MS ?? 5000,
    threshold: config.AI_CIRCUIT_FAILURE_THRESHOLD ?? 3,
    resetMs: config.AI_CIRCUIT_RESET_MS ?? 30000,
    maxActive: config.AI_MAX_CONCURRENT ?? 2,
  };
  const state = () =>
    openUntil > now() ? "OPEN" : openUntil || probe ? "HALF_OPEN" : "CLOSED";
  const emit = (event, context, extra = {}) => {
    // Caller supplies only server-created correlation IDs and fixed role labels.
    try {
      log({
        event,
        requestId: context.requestId,
        role: context.role,
        circuitState: state(),
        ...extra,
      });
    } catch {
      /* Logging failure must not change operational behavior. */
    }
  };
  function open() {
    openUntil = now() + policy.resetMs;
    epoch++;
  }
  async function execute(invoke, { signal, requestId, role } = {}) {
    const context = { requestId, role };
    if (signal?.aborted) throw cancelled();
    if (openUntil > now() || probe)
      throw unavailable("AI_CIRCUIT_OPEN", "CIRCUIT_OPEN");
    if (cooldownUntil > now())
      throw unavailable("AI_PROVIDER_COOLDOWN", "PROVIDER_COOLDOWN");
    if (active >= policy.maxActive)
      throw unavailable("AI_BUSY", "CONCURRENCY_LIMIT");
    const isProbe = Boolean(openUntil);
    if (isProbe) probe = true;
    active++;
    const started = now(),
      deadline = started + config.AI_TIMEOUT_MS;
    let attempts = 0,
      pending,
      settled = true;
    try {
      for (;;) {
        if (signal?.aborted) throw cancelled();
        if (now() >= deadline)
          throw new ApiError(
            504,
            "AI_TIMEOUT",
            "The assessment deadline elapsed.",
            { category: "AGENT_DEADLINE" },
          );
        if (!isProbe && openUntil)
          throw unavailable("AI_CIRCUIT_OPEN", "CIRCUIT_OPEN");
        const attemptEpoch = epoch;
        const controller = new AbortController();
        const remaining = deadline - now();
        const timeoutMs = Math.min(policy.attemptMs, remaining);
        let timer, cancel;
        attempts++;
        settled = false;
        try {
          const stop = new Promise((_, reject) => {
            cancel = () => {
              reject(cancelled());
              controller.abort();
            };
            signal?.addEventListener("abort", cancel, { once: true });
            timer = setTimeout(() => {
              reject(
                new ApiError(
                  504,
                  "AI_TIMEOUT",
                  "The assessment deadline elapsed.",
                  {
                    category:
                      timeoutMs === remaining
                        ? "AGENT_DEADLINE"
                        : "ATTEMPT_TIMEOUT",
                  },
                ),
              );
              controller.abort();
            }, timeoutMs);
          });
          pending = Promise.resolve().then(() => {
            if (signal?.aborted || controller.signal.aborted) throw cancelled();
            return invoke({ signal: controller.signal, timeoutMs });
          });
          pending.then(
            () => {
              settled = true;
            },
            () => {
              settled = true;
            },
          );
          const value = await Promise.race([pending, stop]);
          if (epoch === attemptEpoch) {
            failures = 0;
            openUntil = 0;
            if (isProbe) probe = false;
          }
          emit("AI_PROVIDER_SUCCEEDED", context, {
            attempts,
            elapsedMs: now() - started,
          });
          return { value, attempts, circuitState: state() };
        } catch (raw) {
          if (signal?.aborted || raw?.code === "AI_CANCELLED")
            throw cancelled();
          const error = sanitizeProviderError(raw);
          const retryAfter = providerRetryAfterMs(raw, now());
          if (transient(error) && retryAfter != null)
            cooldownUntil = Math.max(cooldownUntil, now() + retryAfter);
          if (transient(error) && epoch === attemptEpoch) {
            failures++;
            if (isProbe || failures >= policy.threshold) open();
          } else if (isProbe && epoch === attemptEpoch) open();
          error.details = { ...error.details, attempts, circuitState: state() };
          emit("AI_PROVIDER_ATTEMPT_FAILED", context, {
            code: error.code,
            attempts,
            elapsedMs: now() - started,
          });
          // Never overlap a retry with a transport which ignored cancellation.
          if (
            !transient(error) ||
            !settled ||
            isProbe ||
            openUntil ||
            attempts > policy.retries
          )
            throw error;
          const cap = Math.min(
            policy.maxDelayMs,
            policy.baseMs * 2 ** (attempts - 1),
          );
          const jitter = Math.round(
            cap * (0.5 + Math.max(0, Math.min(1, random())) * 0.5),
          );
          const waitMs = Math.max(jitter, cooldownUntil - now());
          // A long provider Retry-After is a refusal to retry within our budget,
          // never permission to truncate its delay and call earlier.
          if (waitMs > policy.maxDelayMs || now() + waitMs >= deadline)
            throw error;
          cooldownUntil = Math.max(cooldownUntil, now() + waitMs);
          emit("AI_RETRY_SCHEDULED", context, { attempts, delayMs: waitMs });
          clearTimeout(timer);
          signal?.removeEventListener("abort", cancel);
          try {
            await sleep(waitMs, signal);
          } catch {
            throw cancelled();
          }
          // Another concurrent failure may have extended the global cooldown.
          if (cooldownUntil > now())
            throw unavailable("AI_PROVIDER_COOLDOWN", "PROVIDER_COOLDOWN");
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", cancel);
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.code !== "AI_CANCELLED")
        error.details = { ...error.details, attempts, circuitState: state() };
      throw error;
    } finally {
      const release = () => {
        active--;
        if (isProbe) probe = false;
      };
      if (pending && !settled) pending.then(release, release);
      else release();
    }
  }
  return {
    execute,
    snapshot: () => ({
      state: state(),
      active,
      failures,
      openUntil,
      cooldownUntil,
    }),
  };
}
