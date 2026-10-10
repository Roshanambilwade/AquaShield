// Imported only by automated tests. Never inherit a live provider key or the
// normal/demo MongoDB target from the developer's private root .env.
export function testEnvironment(source) {
  return {
    ...source,
    NODE_ENV: "test",
    MONGODB_URI:
      source.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017/aquashield_tests",
    GEMINI_API_KEY: "",
    GEMINI_MODEL_ID: "",
    DEMO_AI_MODE: "true",
    DEMONSTRATION_MODE: "false",
    DEMO_SEED_ENABLED: "false",
    ROUTING_BASE_URL: "",
  };
}
Object.assign(process.env, testEnvironment(process.env));
