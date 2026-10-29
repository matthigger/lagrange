// The objective f over the plane, with the constraint path, the point on
// it and its gradients, as a contour map or an orbitable 3D surface.
//
// f is sampled on a grid: filled bands come from a canvas image and level
// lines from marching squares, at evenly spaced round values. Both axes
// share one scale, so a gradient is perpendicular to its level lines on
// screen as it is in the math. ∇f and ∇g are drawn to one common scale
// (st.k pixels per unit), so where they line up ∇f is λ times as long.
//
// The point lives on the path: dragging anywhere (contour) or on the path
// or point (3D) moves it to the path point nearest the pointer on screen.
// 3D draws the surface as a mesh under an orthographic orbit camera, the
// path on the floor and lifted onto the surface; dragging elsewhere
// orbits and the wheel zooms.

const PLOT = { w: 560, h: 560, x0: 62, x1: 546, y0: 14, y1: 498 };
const GRID = 140;
const MESH = 30;
const ARROW_MAX = 200;
// Surface ramp, low (light) to high (dark), one hue.
const RAMP_LO = [247, 248, 252];
const RAMP_HI = [150, 172, 214];

/**
 * Orthographic orbit camera: world (X, Y, Z), floor in [-1, 1]^2, to
 * screen { x, y, depth } (depth grows away from the camera).
 */
function orbitProject(cam, [X, Y, Z]) {
  const { theta, phi, zoom } = cam, s = 175 * zoom;
  const xr = X * Math.cos(theta) - Y * Math.sin(theta);
  const yr = X * Math.sin(theta) + Y * Math.cos(theta);
  return {
    x: PLOT.w / 2 + s * xr,
    y: PLOT.h * 0.6 - s * (Z * Math.cos(phi) + yr * Math.sin(phi)),
    depth: yr * Math.cos(phi) - Z * Math.sin(phi),
  };
}

// Light direction for the 3D mesh, toward the viewer's upper left.
const LIGHT = (() => {
  const l = [-0.4, -0.6, 1], n = Math.hypot(...l);
  return l.map(c => c / n);
})();

function rampRGB(t) {
  return RAMP_LO.map((lo, i) => Math.round(lo + t * (RAMP_HI[i] - lo)));
}
/** Ramp color at t, dimmed by the factor light (1 = full). */
function ramp(t, light = 1) {
  return `rgb(${rampRGB(t).map(c => Math.round(c * light)).join(",")})`;
}

/** Lambert light factor of the quad a, b, c, d (world coordinates). */
function quadLight(a, b, c, d) {
  const p = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const q = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
  const n = [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2],
    p[0] * q[1] - p[1] * q[0]];
  const len = Math.hypot(...n) || 1;
  const cos = Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2])
    / len;
  return 0.7 + 0.3 * cos;
}

class SurfView {
  /**
   * Args:
   *   svg (SVGElement): the view's SVG
   *   onPick (function): onPick(u, done) while dragging the point (done
   *     false) and on release; the caller redraws
   */
  constructor(svg, onPick) {
    this.svg = svg;
    this.onPick = onPick;
    this.cam = { theta: -0.35, phi: 0.62, zoom: 1 };
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = GRID;
    this.drag = null;
    this.prob = null;
    // Screen positions of the path samples, from the last render.
    this.pathScreen = [];
    svg.setAttribute("viewBox", `0 0 ${PLOT.w} ${PLOT.h}`);
    this.listen();
  }

  sx(v) { return PLOT.x0 + (v - this.mid[0] + this.hw) * this.ppu; }
  sy(v) { return PLOT.y1 - (v - this.mid[1] + this.hw) * this.ppu; }
  /** Domain point at fractions (a, b) across, from the bottom left. */
  at(a, b) {
    return [this.mid[0] - this.hw + 2 * this.hw * a,
      this.mid[1] - this.hw + 2 * this.hw * b];
  }

  /** Sample f (and g) over the problem's view; cache the contour picture. */
  sample(prob) {
    this.prob = prob;
    this.mid = prob.view.mid;
    this.hw = prob.view.hw;
    this.ppu = (PLOT.x1 - PLOT.x0) / (2 * this.hw);
    const N = GRID;
    const grid = fn => {
      const z = new Float64Array((N + 1) * (N + 1));
      let lo = Infinity, hi = -Infinity;
      for (let j = 0; j <= N; j++) {
        for (let i = 0; i <= N; i++) {
          const v = fn(this.at(i / N, j / N));
          z[j * (N + 1) + i] = v;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
      return { z, lo, hi };
    };
    const F = grid(prob.f);
    this.z = F.z;
    this.flo = F.lo;
    this.fhi = F.hi;
    this.levels = ticks(F.lo, F.hi, 14).filter(L => L > F.lo && L < F.hi);
    const G = grid(prob.g);
    this.glines = ticks(G.lo, G.hi, 10)
      .filter(L => Math.abs(L) > 1e-9 * (G.hi - G.lo))
      .map(L => this.marchZ(G.z, L));
    this.paintBands();
    this.lines = this.levels.map(L => this.marchZ(this.z, L));
  }

  marchZ(z, L) {
    const N = GRID;
    return march(z, N, L, i => PLOT.x0 + i / N * (PLOT.x1 - PLOT.x0),
      j => PLOT.y1 - j / N * (PLOT.y1 - PLOT.y0));
  }

  /** Shade of an f value: 0 (lowest band) .. 1 (highest). */
  shade(v) {
    let k = 0;
    while (k < this.levels.length && v > this.levels[k]) k++;
    return k / Math.max(this.levels.length, 1);
  }

  paintBands() {
    const N = GRID, ctx = this.canvas.getContext("2d");
    const img = ctx.createImageData(N, N), z = this.z;
    for (let py = 0; py < N; py++) {
      for (let px = 0; px < N; px++) {
        // Canvas rows run top-down; the grid runs bottom-up. Sample the
        // middle of each pixel's cell.
        const j = N - 1 - py;
        const v = (z[j * (N + 1) + px] + z[j * (N + 1) + px + 1]
          + z[(j + 1) * (N + 1) + px] + z[(j + 1) * (N + 1) + px + 1]) / 4;
        const c = rampRGB(this.shade(v)), o = 4 * (py * N + px);
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.image = this.canvas.toDataURL();
  }

  /**
   * Draw the view.
   *
   * Args:
   *   st (object): { prob, table (PathTable), u, mode: "contour" | "3d",
   *     show: { split, flevel, glevels, crit }, k (arrow pixels per
   *     gradient unit), sols: prob.sols, each with its u when on the path }
   */
  render(st) {
    if (st.prob !== this.prob) this.sample(st.prob);
    this.st = st;
    this.svg.innerHTML = "";
    this.svg.classList.toggle("orbit", st.mode === "3d");
    if (st.mode === "3d") this.draw3d(st);
    else this.drawContour(st);
  }

  drawContour(st) {
    const svg = this.svg, P = PLOT, prob = st.prob;
    const S = p => [this.sx(p[0]), this.sy(p[1])];
    const defs = node("defs", {}, svg);
    const clip = node("clipPath", { id: `${svg.id}-clip` }, defs);
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0 }, clip);
    const g = node("g", { "clip-path": `url(#${svg.id}-clip)` }, svg);
    node("image", { href: this.image, x: P.x0, y: P.y0,
      width: P.x1 - P.x0, height: P.y1 - P.y0, preserveAspectRatio: "none",
      class: "bands" }, g);
    for (const segs of this.lines) {
      node("path", { d: segPath(segs), class: "flevel" }, g);
    }
    if (Math.abs(this.mid[0]) <= this.hw) {
      const x = this.sx(0);
      node("line", { x1: x, x2: x, y1: P.y0, y2: P.y1, class: "axis0" }, g);
    }
    if (Math.abs(this.mid[1]) <= this.hw) {
      const y = this.sy(0);
      node("line", { x1: P.x0, x2: P.x1, y1: y, y2: y, class: "axis0" }, g);
    }
    this.labels(g);
    if (prob.veil) {
      const pat = node("pattern", { id: `${svg.id}-hatch`, width: 9,
        height: 9, patternUnits: "userSpaceOnUse",
        patternTransform: "rotate(45)" }, defs);
      node("line", { x1: 0, y1: 0, x2: 0, y2: 9, class: "hatch" }, pat);
      node("polygon", { points: ptsAttr(prob.veil.map(S)), class: "veil" },
        g);
      node("polygon", { points: ptsAttr(prob.veil.map(S)),
        fill: `url(#${svg.id}-hatch)` }, g);
    }
    if (st.show.glevels) {
      for (const segs of this.glines) {
        node("path", { d: segPath(segs), class: "glevel" }, g);
      }
    }

    this.pathScreen = st.table.pts.map(S);
    this.drawPath(g, this.pathScreen, st.table.closed);

    const x = st.table.pos(st.u), fx = prob.f(x);
    if (st.show.flevel) {
      node("path", { d: segPath(this.marchZ(this.z, fx)),
        class: "here-level" }, g);
    }
    if (prob.free) this.freeMark(g, S(prob.free));
    if (st.show.crit) {
      for (const sol of st.sols) this.solMark(g, S(sol.x), sol);
    }

    const [px, py] = S(x);
    this.arrows(g, st, x, px, py, v => [v[0], -v[1]]);
    node("circle", { cx: px, cy: py, r: 8, class: "handle" }, g);
    this.axes(svg);
  }

  /** The path as a bold line, with a mark and an arrow where s = 0. */
  drawPath(g, pts, closed) {
    node(closed ? "polygon" : "polyline", { points: ptsAttr(pts),
      class: "cpath" }, g);
    const [ax, ay] = pts[0], [bx, by] = pts[Math.min(8, pts.length - 1)];
    const d = Math.hypot(bx - ax, by - ay);
    if (!(d > 0)) return;
    const tx = (bx - ax) / d, ty = (by - ay) / d;
    // Offset to the left of the walking direction, on screen.
    const nx = ty, ny = -tx, o = 15;
    node("circle", { cx: ax, cy: ay, r: 4, class: "s0" }, g);
    arrow(g, ax + o * nx, ay + o * ny, ax + o * nx + 34 * tx,
      ay + o * ny + 34 * ty, "sdir", 7);
    text(g, ax + (o + 13) * nx - 4 * tx, ay + (o + 13) * ny - 4 * ty + 4,
      "s = 0", { class: "s-label", "text-anchor": "middle" });
  }

  /**
   * ∇g, ∇f and (when splitting) ∇f's parts along and across the path, at
   * the point (px, py). toScreen maps a vector to screen axes (unit
   * scale).
   */
  arrows(g, st, x, px, py, toScreen) {
    const prob = st.prob, T = st.table.tangent(st.u);
    const gf = prob.gradF(x), gg = prob.gradG(x), m = dot(gf, T);
    const along = [m * T[0], m * T[1]];
    const across = [gf[0] - along[0], gf[1] - along[1]];
    const draw = (v, cls, label) => {
      let [dx, dy] = toScreen(v).map(c => c * st.k);
      const len = Math.hypot(dx, dy);
      if (len > ARROW_MAX) {
        dx *= ARROW_MAX / len;
        dy *= ARROW_MAX / len;
      }
      arrow(g, px, py, px + dx, py + dy, cls, 11);
      if (label && len > 14) {
        const l = Math.hypot(dx, dy);
        text(g, px + dx + 13 * dx / l, py + dy + 13 * dy / l + 5, label,
          { class: `arrow-label ${cls}`, "text-anchor": "middle" });
      }
    };
    draw(gg, "agrad", `∇${prob.gSym}`);
    if (st.show.split) {
      draw(across, "across", null);
      draw(along, "along", null);
    }
    draw(gf, "fgrad", "∇f");
  }

  freeMark(g, [x, y]) {
    const r = 6;
    node("path", { d: `M${x - r} ${y - r}L${x + r} ${y + r}M${x - r} `
      + `${y + r}L${x + r} ${y - r}`, class: "free" }, g);
    text(g, x - 10, y - 9, "unconstrained min", { class: "sol-label",
      "text-anchor": "end" });
  }

  solMark(g, [x, y], sol) {
    node("path", { d: `M${x} ${y - 8}L${x + 8} ${y}L${x} ${y + 8}`
      + `L${x - 8} ${y}Z`, class: `sol ${sol.kind}` }, g);
    text(g, x + 11, y + 18, sol.kind, { class: "sol-label" });
  }


  /** One value label per level, greedily kept apart from the others. */
  labels(g) {
    const P = PLOT, placed = [];
    const ok = (x, y) => x > P.x0 + 22 && x < P.x1 - 22 && y > P.y0 + 12
      && y < P.y1 - 10;
    this.levels.forEach((L, k) => {
      let best = null, bd = 0;
      const segs = this.lines[k];
      const step = Math.max(1, Math.floor(segs.length / 60));
      for (let s = 0; s < segs.length; s += step) {
        const [[x0, y0], [x1, y1]] = segs[s];
        const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
        if (!ok(x, y)) continue;
        const d = placed.reduce((m, [qx, qy]) =>
          Math.min(m, Math.hypot(x - qx, y - qy)), 1e9);
        if (d > bd) { bd = d; best = [x, y]; }
      }
      if (best && bd > 46) {
        placed.push(best);
        text(g, best[0], best[1] + 4, fmt(L, 2),
          { class: "clabel", "text-anchor": "middle" });
      }
    });
  }

  axes(svg) {
    const P = PLOT, lo0 = this.mid[0] - this.hw, hi0 = this.mid[0] + this.hw;
    const lo1 = this.mid[1] - this.hw, hi1 = this.mid[1] + this.hw;
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0, class: "frame" }, svg);
    for (const t of ticks(lo0, hi0, 6)) {
      text(svg, this.sx(t), P.y1 + 17, fmt(t),
        { class: "tick", "text-anchor": "middle" });
    }
    for (const t of ticks(lo1, hi1, 6)) {
      text(svg, P.x0 - 6, this.sy(t) + 4, fmt(t),
        { class: "tick", "text-anchor": "end" });
    }
    text(svg, (P.x0 + P.x1) / 2, P.y1 + 42, "x₀",
      { class: "axis-label sym", "text-anchor": "middle" });
    text(svg, 18, (P.y0 + P.y1) / 2, "x₁", { class: "axis-label sym",
      "text-anchor": "middle" });
  }

  // ------------------------------------------------------------------ 3D

  /** World coordinates: floor in [-1, 1]^2, height 0..0.9 over the view. */
  world(x, lift = 0) {
    const h = (this.prob.f(x) - this.flo) / (this.fhi - this.flo);
    return [(x[0] - this.mid[0]) / this.hw, (x[1] - this.mid[1]) / this.hw,
      0.9 * h + lift];
  }

  floor(x) {
    return [(x[0] - this.mid[0]) / this.hw, (x[1] - this.mid[1]) / this.hw,
      0];
  }

  project(p) { return orbitProject(this.cam, p); }

  draw3d(st) {
    const svg = this.svg, prob = st.prob;
    const Pr = p => { const r = this.project(p); return [r.x, r.y]; };
    const at = (i, j) => this.at(i / MESH, j / MESH);

    const fl = node("g", { class: "floor" }, svg);
    node("polygon", { points: ptsAttr([[-1, -1], [1, -1], [1, 1], [-1, 1]]
      .map(([X, Y]) => Pr([X, Y, 0]))) }, fl);
    const l0 = Pr([0, -1.2, 0]), l1 = Pr([-1.2, 0, 0]);
    text(fl, l0[0], l0[1], "x₀", { class: "axis-label sym",
      "text-anchor": "middle" });
    text(fl, l1[0], l1[1], "x₁", { class: "axis-label sym",
      "text-anchor": "middle" });
    if (prob.veil) {
      node("polygon", { points: ptsAttr(prob.veil.map(
        p => Pr(this.floor(p)))), class: "veil" }, fl);
    }
    node(st.table.closed ? "polygon" : "polyline", { points: ptsAttr(
      st.table.pts.map(p => Pr(this.floor(p)))), class: "cpath-floor" }, fl);

    const x = st.table.pos(st.u), fx = prob.f(x);
    const base = this.project(this.floor(x));

    const quads = [];
    for (let i = 0; i < MESH; i++) {
      for (let j = 0; j < MESH; j++) {
        const w = [at(i, j), at(i + 1, j), at(i + 1, j + 1),
          at(i, j + 1)].map(p => this.world(p));
        const proj = w.map(p => this.project(p));
        const c = at(i + 0.5, j + 0.5);
        quads.push({ proj, depth: proj.reduce((s, p) => s + p.depth, 0),
          t: this.shade(prob.f(c)), light: quadLight(...w),
          off: prob.veil && prob.g(c) < 0 });
      }
    }
    quads.sort((a, b) => b.depth - a.depth);
    const mesh = node("g", { class: "mesh" }, svg);
    for (const q of quads) {
      node("polygon", { fill: ramp(q.t, q.light), class: q.off ? "off" : "",
        points: q.proj.map(p => `${p.x},${p.y}`).join(" ") }, mesh);
    }

    // The gradients live on the floor (the plane of x), drawn after the
    // mesh so it cannot hide them. On the floor a vector of v screen units
    // at the contour scale spans v / (hw ppu) world units.
    this.arrows(node("g", { class: "floor-arrows" }, svg), st, x, base.x,
      base.y, v => {
        const a = this.project([0, 0, 0]);
        const b = this.project([v[0] / (this.hw * this.ppu),
          v[1] / (this.hw * this.ppu), 0]);
        return [b.x - a.x, b.y - a.y];
      });
    this.pathScreen = st.table.pts.map(p => Pr(this.world(p, 0.006)));
    node(st.table.closed ? "polygon" : "polyline", { points: ptsAttr(
      this.pathScreen), class: "cpath" }, svg);
    if (prob.free) this.freeMark(svg, Pr(this.world(prob.free, 0.006)));
    if (st.show.crit) {
      for (const sol of st.sols) {
        this.solMark(svg, Pr(this.world(sol.x, 0.006)), sol);
      }
    }
    const top = Pr(this.world(x, 0.006));
    node("line", { x1: top[0], y1: top[1], x2: base.x, y2: base.y,
      class: "dropline" }, svg);
    node("circle", { cx: base.x, cy: base.y, r: 4, class: "surf-pt" }, svg);
    node("circle", { cx: top[0], cy: top[1], r: 8, class: "handle" }, svg);
    text(svg, top[0] + 12, top[1] - 12, `f = ${fmt(fx)}`,
      { class: "tip-label" });
  }

  // ---------------------------------------------------------- pointer

  /** Squared screen distance from p to the nearest path sample. */
  pathDist(p) {
    let bd = Infinity;
    for (const [x, y] of this.pathScreen) {
      bd = Math.min(bd, (x - p.x) ** 2 + (y - p.y) ** 2);
    }
    return bd;
  }

  /** The u of the path point nearest p on screen. */
  pick(p) {
    const st = this.st;
    const S = st.mode === "3d"
      ? q => { const r = this.project(this.world(q, 0.006)); return [r.x, r.y]; }
      : q => [this.sx(q[0]), this.sy(q[1])];
    return st.table.nearest(q => {
      const [x, y] = S(q);
      return (x - p.x) ** 2 + (y - p.y) ** 2;
    });
  }

  listen() {
    const svg = this.svg;
    svg.addEventListener("pointerdown", e => {
      if (e.button !== 0 || !this.prob) return;
      const p = svgPoint(svg, e);
      if (this.st.mode === "3d") {
        const onPt = e.target.classList.contains("handle")
          || this.pathDist(p) < 14 ** 2;
        this.drag = onPt ? { pick: true } : { orbit: true, x: p.x, y: p.y };
      } else {
        const P = PLOT;
        if (p.x < P.x0 || p.x > P.x1 || p.y < P.y0 || p.y > P.y1) return;
        this.drag = { pick: true };
      }
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      this.move(p);
    });
    svg.addEventListener("pointermove", e => {
      if (this.drag) this.move(svgPoint(svg, e));
    });
    const end = () => {
      const d = this.drag;
      this.drag = null;
      if (d && d.pick) this.onPick(this.st.u, true);
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("wheel", e => {
      if (!this.st || this.st.mode !== "3d") return;
      e.preventDefault();
      this.cam.zoom = clamp(this.cam.zoom * Math.exp(-e.deltaY * 0.001),
        0.4, 3);
      this.render(this.st);
    }, { passive: false });
  }

  move(p) {
    const d = this.drag;
    if (d.orbit) {
      this.cam.theta += (p.x - d.x) * 0.01;
      this.cam.phi = clamp(this.cam.phi + (p.y - d.y) * 0.01, 0.15, 1.45);
      d.x = p.x;
      d.y = p.y;
      this.render(this.st);
      return;
    }
    this.onPick(this.pick(p), false);
  }
}
