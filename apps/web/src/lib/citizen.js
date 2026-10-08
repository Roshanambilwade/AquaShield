const storageKey = "aquashield.citizen-key.v1";

export function getCitizenToken() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (/^[a-f0-9]{64}$/.test(saved || "")) return saved;
    const token = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (value) => value.toString(16).padStart(2, "0"),
    ).join("");
    localStorage.setItem(storageKey, token);
    return token;
  } catch {
    throw new Error(
      "Browser storage is unavailable. Enable local storage to save and access your reports.",
    );
  }
}
