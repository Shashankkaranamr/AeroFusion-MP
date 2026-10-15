/**
 * Causal Haar "à trous" multi-resolution analysis.
 *
 * c_{j+1}[n] = (c_j[n] + c_j[n − 2^j]) / 2,   d_{j+1}[n] = c_j[n] − c_{j+1}[n]
 *
 * Only past samples are used, so it is safe for forecasting (no look-ahead), and
 * x = c_J + Σ d_j holds exactly.  This mirrors the wavelet branch in ml/src/aerofusion/models/wavelet.py.
 */
export function haarAtrous(x: number[], levels = 5) {
  const details: number[][] = [];
  let c = x.slice();
  for (let j = 0; j < levels; j++) {
    const step = 2 ** j;
    const next = c.map((v, n) => (n - step >= 0 ? (v + c[n - step]) / 2 : v));
    details.push(c.map((v, n) => v - next[n]));
    c = next;
  }
  return { approx: c, details };
}

/** Group bands into human-readable components for hourly PM2.5. */
export function wavelet3Bands(x: number[]) {
  const { approx, details } = haarAtrous(x, 5);
  // d1,d2 (≤4 h) = spikes; d3..d5 (8–32 h) = daily cycle; approx = trend.
  const spikes = x.map((_, n) => details[0][n] + details[1][n]);
  const daily = x.map((_, n) => details[2][n] + details[3][n] + details[4][n]);
  const energy = (arr: number[]) => arr.reduce((s, v) => s + v * v, 0);
  const meanX = x.reduce((s, v) => s + v, 0) / (x.length || 1);
  const trendCentered = approx.map((v) => v - meanX);
  const eS = energy(spikes);
  const eD = energy(daily);
  const eT = energy(trendCentered);
  const tot = eS + eD + eT || 1;
  return {
    trend: approx,
    daily,
    spikes,
    energy: { trend: (eT / tot) * 100, daily: (eD / tot) * 100, spikes: (eS / tot) * 100 },
  };
}
