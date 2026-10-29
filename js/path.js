// A constraint path sampled densely, for arc length, tangents and picking.
//
// The path is pos(u) for u in [u0, u1] (see problems.js). Arc length s
// runs from 0 at u0 to L at u1, so the plot of f along the path has slope
// u · ∇f, the rate f changes per unit walked, where u is the unit tangent.

const PATH_N = 1200;

class PathTable {
  constructor(path) {
    this.path = path;
    const { u0, u1 } = path, n = PATH_N;
    this.u = new Float64Array(n + 1);
    this.s = new Float64Array(n + 1);
    this.pts = [];
    let s = 0, prev = null;
    for (let i = 0; i <= n; i++) {
      const u = u0 + (u1 - u0) * i / n, p = path.pos(u);
      if (prev) s += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      this.u[i] = u;
      this.s[i] = s;
      this.pts.push(p);
      prev = p;
    }
    this.L = s;
  }

  get closed() { return this.path.closed; }

  pos(u) { return this.path.pos(u); }

  /** Wrap (closed path) or clamp (open path) u into [u0, u1]. */
  wrap(u) {
    const { u0, u1 } = this.path;
    if (!this.closed) return clamp(u, u0, u1);
    const T = u1 - u0;
    return u0 + (((u - u0) % T) + T) % T;
  }

  /** Arc length at u. */
  sAt(u) {
    const { u0, u1 } = this.path, n = PATH_N;
    const f = (this.wrap(u) - u0) / (u1 - u0) * n;
    const i = Math.min(Math.floor(f), n - 1), t = f - i;
    return this.s[i] + t * (this.s[i + 1] - this.s[i]);
  }

  /** The u at arc length s (wrapped or clamped like u). */
  uAt(s) {
    const L = this.L;
    s = this.closed ? ((s % L) + L) % L : clamp(s, 0, L);
    let lo = 0, hi = PATH_N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.s[mid] <= s) lo = mid; else hi = mid;
    }
    const ds = this.s[hi] - this.s[lo];
    const t = ds > 0 ? (s - this.s[lo]) / ds : 0;
    return this.u[lo] + t * (this.u[hi] - this.u[lo]);
  }

  /** Unit tangent at u, pointing toward increasing s. */
  tangent(u) {
    const { u0, u1 } = this.path, h = (u1 - u0) * 1e-6;
    const a = this.pos(this.closed ? u - h : Math.max(u - h, u0));
    const b = this.pos(this.closed ? u + h : Math.min(u + h, u1));
    const d = [b[0] - a[0], b[1] - a[1]], n = norm(d);
    return [d[0] / n, d[1] / n];
  }

  /**
   * The u whose point minimizes dist(point): the best sample, refined by
   * ternary search between its neighbours.
   */
  nearest(dist) {
    let best = 0, bd = Infinity;
    this.pts.forEach((p, i) => {
      const d = dist(p);
      if (d < bd) { bd = d; best = i; }
    });
    const du = this.u[1] - this.u[0];
    let lo = this.u[best] - du, hi = this.u[best] + du;
    if (!this.closed) {
      lo = Math.max(lo, this.path.u0);
      hi = Math.min(hi, this.path.u1);
    }
    for (let k = 0; k < 60; k++) {
      const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
      if (dist(this.pos(a)) < dist(this.pos(b))) hi = b; else lo = a;
    }
    return this.wrap((lo + hi) / 2);
  }

  /** The u nearest a point x in the plane. */
  nearestTo(x) {
    return this.nearest(p => (p[0] - x[0]) ** 2 + (p[1] - x[1]) ** 2);
  }

  /** Signed arc distance from s to t, the short way round if closed. */
  gap(s, t) {
    let d = t - s;
    if (this.closed) d -= this.L * Math.round(d / this.L);
    return d;
  }
}
