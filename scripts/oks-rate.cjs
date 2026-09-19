/** OKS contributionRateOverride is a fraction (0.03 = 3%). Roster sometimes stores 3. */
function oksFraction(v) {
  if (v == null || v === "") return v;
  let n = Number(v);
  if (!Number.isFinite(n) || n === 0) return n;
  while (n > 1) n /= 100;
  return Math.round(n * 1e8) / 1e8;
}

module.exports = { oksFraction };
