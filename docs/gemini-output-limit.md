# Gemini output-limit diagnosis

## Confirmed failure path

The supplied live log ends in `AI_INVALID_OUTPUT / MODEL_OUTPUT_LIMIT`.
Before this fix, `providerErrors.js` emitted that category only for a
`MaxTokensError` in the SDK error/cause chain. In installed Strands SDK 1.20.0,
the Google adapter maps Google's `MAX_TOKENS` finish reason to `maxTokens`;
the model stream consumer then throws `MaxTokensError`. This identifies a
provider-reported per-generation output-token limit, rather than the local
JSON character bound, evidence validation, agent deadline, or cumulative
invocation token limit.

The application configured 3,000 maximum output tokens per Google generation,
6,000 cumulative invocation output tokens, three agent turns, and a bounded
environment-configured timeout. Those limits are unchanged. The adapter's usage
accounting includes candidate and thought tokens. The old logs do not contain
usage metadata, so they cannot establish the actual reasoning/answer split.

The old schema permitted prose fields of 1,200 characters, six reasons, and
twelve missing-information items, without a concise-answer instruction.
That contract allowed an answer far larger than the per-request token budget.
Two generation requests do not establish two retries: Strands can call the
read-only evidence tool and then request a structured answer, or attempt to
correct structured output. Automatic provider retries are disabled. The old
logs cannot distinguish which tool flow actually occurred.

## Scoped correction

- Require a direct `strands_structured_output` response from the supplied
  snapshot, without a separate essay or repeated evidence retrieval.
- Bound each prose item to 320 characters, reasons to three, and generated
  missing-information items to six. The backend still supplements the latter
  with authoritative missing inputs.
- Observe Google stream completion before Strands handles tool calls. The
  installed adapter prioritizes `toolUse` over `MAX_TOKENS` when both occur;
  AquaShield now rejects that combination even with parseable tool arguments.
- Preserve `MODEL_OUTPUT_LIMIT` through SDK-wrapped errors. A stream ending
  without a completion reason has the distinct `PROVIDER_STREAM_INCOMPLETE`
  category. Existing timeout, authentication, quota and network categories stay
  intact.
- Live diagnostics report fixed finish-reason labels, request number, configured
  output cap, input character count, chunk count, elapsed time, fixed tool-role
  labels and allowlisted numerical usage metadata when Google supplies it.
  Prompts, tool arguments, response text, reasoning, keys, unknown tool names,
  and raw provider errors are never printed.

Strict schema validation and `validateAdvice()` remain mandatory. No truncated
JSON is accepted, no retries were added, and real mode never falls back to demo.
The provider/model and all request cancellation/deadline mechanisms remain.

## Verification and retry

Offline verification: `npm test` passed 126 tests; `npm run lint` and
`npm run build` passed. New mocked tests exercise text truncation, parseable
tool-call truncation, missing completion reason, a successful two-request
evidence/structured-output flow, diagnostic redaction, and concise schema
bounds. Existing four-role mocked Strands/GoogleModel tests remain passing.
These results are not proof of successful live Gemini execution.

No live Gemini calls were made for this fix. Resolution of the live output
exhaustion remains unverified. After separate explicit authorization, run from
the repository root:

```powershell
node apps/api/src/scripts/testLiveAi.js --role=detect
```

The script loads the root `.env`, requires the existing backend
`GEMINI_API_KEY` and `GEMINI_MODEL_ID`, and explicitly enables real mode. Keep
the configured model unchanged and the bounded `AI_TIMEOUT_MS` setting. This
command makes a model-access metadata request followed by up to three agent
generation turns with synthetic evidence and may incur Google API charges.
Do not share `.env` or the key.

Expected success: `VERIFIED_REAL_GEMINI` with `validation: PASSED`. On failure,
inspect the safe per-request finish reason, usage and tool-role labels to
determine whether reasoning/answer tokens exhausted the cap, structured output
failed validation, or another provider/deadline category occurred. Do not raise
limits or change models without that evidence.
