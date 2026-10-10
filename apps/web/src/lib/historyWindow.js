export function initialWindow(days = 7) {
  const to = new Date();
  return {
    from: new Date(+to - days * 86400000).toISOString().slice(0, 16),
    to: to.toISOString().slice(0, 16),
  };
}
export function windowQuery(values) {
  const from = new Date(`${values.from}:00Z`),
    to = new Date(`${values.to}:00Z`);
  if (
    !Number.isFinite(+from) ||
    !Number.isFinite(+to) ||
    +from >= +to ||
    +to - +from > 90 * 86400000 ||
    +to > Date.now() + 60000
  )
    throw new Error(
      "Choose an increasing UTC window of at most 90 days, ending no later than now.",
    );
  return { from: from.toISOString(), to: to.toISOString() };
}
