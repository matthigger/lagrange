// The path unrolled: f against arc length s, with the point and the line
// through it whose slope is the part of ∇f along the path. Dragging
// moves the point to the s under the pointer.
//
// SweepChart is the small chart some examples add: a quantity of the
// solution (the best f, or λ) against the example's slider value.

const PP = { w: 560, h: 380, x0: 62, x1: 546, y0: 16, y1: 326 };

class PathPlot {
  /**
   * Args:
   *   svg (SVGElement): the plot's SVG
   *   onPick (function): onPick(u, done), as for SurfView
   */
  constructor(svg, onPick) {
    this.svg = svg;
    this.onPick = onPick;
    this.st = null;
    svg.setAttribute("viewBox", `0 0 ${PP.w} ${PP.h}`);
    this.listen();
  }

  /** Draw for the same state as SurfView.render. */
  render(st) {
    this.st = st;
    const svg = this.svg, P = PP, { table, prob } = st;
    svg.innerHTML = "";
    const fs = table.pts.map(prob.f);
    let lo = Math.min(...fs), hi = Math.max(...fs);
    if (!(hi - lo > 1e-9)) { lo -= 1; hi += 1; }
    const pad = 0.1 * (hi - lo);
    lo -= pad;
    hi += pad;
    this.L = table.L;
    const X = s => P.x0 + s / table.L * (P.x1 - P.x0);
    const Y = v => P.y1 - (v - lo) / (hi - lo) * (P.y1 - P.y0);
    this.X = X;

    for (const t of ticks(lo, hi, 6)) {
      node("line", { x1: P.x0, x2: P.x1, y1: Y(t), y2: Y(t), class: "grid" },
        svg);
      text(svg, P.x0 - 6, Y(t) + 4, fmt(t), { class: "tick",
        "text-anchor": "end" });
    }
    for (const t of ticks(0, table.L, 6)) {
      text(svg, X(t), P.y1 + 17, fmt(t), { class: "tick",
        "text-anchor": "middle" });
    }
    const defs = node("defs", {}, svg);
    const clip = node("clipPath", { id: `${svg.id}-clip` }, defs);
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0 }, clip);
    const g = node("g", { "clip-path": `url(#${svg.id}-clip)` }, svg);
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0, class: "pp-bg" }, g);
    node("polyline", { points: ptsAttr(fs.map((v, i) =>
      [X(table.s[i]), Y(v)])), class: "fcurve" }, g);

    if (st.show.crit) {
      for (const sol of st.sols) {
        if (sol.s === undefined) continue;
        const x = X(sol.s), y = Y(prob.f(sol.x));
        node("path", { d: `M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}`
          + `L${x - 7} ${y}Z`, class: `sol ${sol.kind}` }, g);
      }
    }

    const x = table.pos(st.u), s = table.sAt(st.u), fx = prob.f(x);
    const m = dot(prob.gradF(x), table.tangent(st.u));
    const d = 0.1 * table.L;
    node("line", { x1: X(s - d), y1: Y(fx - m * d), x2: X(s + d),
      y2: Y(fx + m * d), class: "slope" }, g);
    node("line", { x1: X(s), x2: X(s), y1: Y(fx), y2: P.y1, class: "mark" },
      g);
    node("circle", { cx: X(s), cy: Y(fx), r: 7, class: "handle" }, g);
    const tx = clamp(X(s) + 12, P.x0 + 4, P.x1 - 80);
    text(g, tx, clamp(Y(fx) - 14, P.y0 + 16, P.y1 - 8),
      `slope ${fmt(m)}`, { class: "tip-label slope-label" });

    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0, class: "frame" }, svg);
    text(svg, (P.x0 + P.x1) / 2, P.y1 + 42, "distance s along the path",
      { class: "axis-label", "text-anchor": "middle" });
    text(svg, 18, (P.y0 + P.y1) / 2, "f", { class: "axis-label sym",
      "text-anchor": "middle" });
  }

  listen() {
    const svg = this.svg;
    const go = (e, done) => {
      const p = svgPoint(svg, e);
      const s = clamp((p.x - PP.x0) / (PP.x1 - PP.x0), 0, 1) * this.L;
      this.onPick(this.st.table.uAt(s), done);
    };
    svg.addEventListener("pointerdown", e => {
      if (e.button !== 0 || !this.st) return;
      this.dragging = true;
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      go(e, false);
    });
    svg.addEventListener("pointermove", e => {
      if (this.dragging) go(e, false);
    });
    const end = e => {
      if (!this.dragging) return;
      this.dragging = false;
      go(e, true);
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }
}

const SW = { w: 560, h: 250, x0: 62, x1: 546, y0: 14, y1: 200 };

class SweepChart {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute("viewBox", `0 0 ${SW.w} ${SW.h}`);
  }

  /**
   * Draw sweep.y over the slider's range, a dot at the value p and, when
   * the sweep has a slope, its tangent there.
   *
   * Args:
   *   sweep (object): { title, xlabel, ylabel, y(p), slope?(p), note(p) }
   *   slider (object): { min, max }
   *   p (number): the slider value
   */
  render(sweep, slider, p) {
    const svg = this.svg, P = SW;
    svg.innerHTML = "";
    const n = 200, xs = [];
    for (let i = 0; i <= n; i++) {
      xs.push(slider.min + (slider.max - slider.min) * i / n);
    }
    const ys = xs.map(sweep.y);
    let lo = Math.min(0, ...ys), hi = Math.max(...ys);
    hi += 0.1 * (hi - lo);
    const X = v => P.x0 + (v - slider.min) / (slider.max - slider.min)
      * (P.x1 - P.x0);
    const Y = v => P.y1 - (v - lo) / (hi - lo) * (P.y1 - P.y0);
    for (const t of ticks(lo, hi, 4)) {
      node("line", { x1: P.x0, x2: P.x1, y1: Y(t), y2: Y(t), class: "grid" },
        svg);
      text(svg, P.x0 - 6, Y(t) + 4, fmt(t), { class: "tick",
        "text-anchor": "end" });
    }
    for (const t of ticks(slider.min, slider.max, 6)) {
      text(svg, X(t), P.y1 + 17, fmt(t), { class: "tick",
        "text-anchor": "middle" });
    }
    const defs = node("defs", {}, svg);
    const clip = node("clipPath", { id: `${svg.id}-clip` }, defs);
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0 }, clip);
    const g = node("g", { "clip-path": `url(#${svg.id}-clip)` }, svg);
    node("polyline", { points: ptsAttr(xs.map((v, i) => [X(v), Y(ys[i])])),
      class: "fcurve" }, g);
    const y = sweep.y(p);
    if (sweep.slope) {
      const m = sweep.slope(p), d = 0.15 * (slider.max - slider.min);
      node("line", { x1: X(p - d), y1: Y(y - m * d), x2: X(p + d),
        y2: Y(y + m * d), class: "slope" }, g);
    }
    node("circle", { cx: X(p), cy: Y(y), r: 6, class: "surf-pt" }, g);
    node("rect", { x: P.x0, y: P.y0, width: P.x1 - P.x0,
      height: P.y1 - P.y0, class: "frame" }, svg);
    text(svg, (P.x0 + P.x1) / 2, P.y1 + 40, sweep.xlabel,
      { class: "axis-label", "text-anchor": "middle" });
    // Rotate only labels longer than a symbol or two.
    const yl = (P.y0 + P.y1) / 2, long = sweep.ylabel.length > 2;
    text(svg, 18, yl + (long ? 0 : 5), sweep.ylabel, {
      class: long ? "axis-label" : "axis-label sym", "text-anchor": "middle",
      ...(long ? { transform: `rotate(-90 18 ${yl})` } : {}) });
  }
}
