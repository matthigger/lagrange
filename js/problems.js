// Constrained problems for both tabs: an objective f, one constraint, the
// path the constraint leaves to walk on, and the known solutions.
//
// Each preset's build(p) takes its slider value (when it has a slider)
// and returns
//
//   { f(x), gradF(x), g(x), gradG(x), gSym,
//     path: { closed, u0, u1, pos(u) },
//     view: { mid: [m0, m1], hw },
//     sols: [{ x, lam, kind: "max" | "min", inside? }],
//     ineq?, veil?: [[x0, x1], ...], free?: [x0, x1] }
//
// g(x) = 0 on the path. For an inequality h(x) >= 0 (ineq true), g is h,
// gSym is "h", the path is the boundary h = 0, veil is the infeasible part
// of the view (shaded) and free is the unconstrained optimum. A solution
// with inside true is off the path (the constraint is inactive).
//
// The html fields hold the page text: title, problem, system (the
// equations of ∇f = λ∇g plus the constraint), solution and try (list
// items, with answers).

const X0 = "<i>x</i><sub>0</sub>", X1 = "<i>x</i><sub>1</sub>";
const LAM = "<i>&lambda;</i>", BX = "<b>x</b>", BW = "<b>w</b>";
const SEP = '<span class="sep"></span>';
const R2 = Math.SQRT1_2;

function unitCircle() {
  return { closed: true, u0: 0, u1: 2 * Math.PI,
    pos: u => [Math.cos(u), Math.sin(u)] };
}

const ON_CIRCLE = {
  g: x => x[0] ** 2 + x[1] ** 2 - 1,
  gradG: x => [2 * x[0], 2 * x[1]],
  gSym: "g",
  path: unitCircle(),
  view: { mid: [0, 0], hw: 1.3 },
};

/** Part of the line p + u d inside the view, as an open path. */
function lineInView(p, d, view) {
  let lo = -Infinity, hi = Infinity;
  for (const i of [0, 1]) {
    if (Math.abs(d[i]) < 1e-12) continue;
    const a = (view.mid[i] - view.hw - p[i]) / d[i];
    const b = (view.mid[i] + view.hw - p[i]) / d[i];
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  const pad = 1e-3 * (hi - lo);
  return { closed: false, u0: lo + pad, u1: hi - pad,
    pos: u => [p[0] + u * d[0], p[1] + u * d[1]] };
}

/** The view's square, counterclockwise from the bottom left. */
function viewSquare(view) {
  const [m0, m1] = view.mid, h = view.hw;
  return [[m0 - h, m1 - h], [m0 + h, m1 - h], [m0 + h, m1 + h],
    [m0 - h, m1 + h]];
}

/** Clip a convex polygon to the half-plane a · x >= b. */
function clipHalf(poly, a, b) {
  const out = [], inside = p => dot(a, p) >= b;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    if (inside(p)) out.push(p);
    if (inside(p) !== inside(q)) {
      const t = (b - dot(a, p)) / dot(a, [q[0] - p[0], q[1] - p[1]]);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  });
  return out;
}

/** Top and bottom eigenpairs of a symmetric 2 x 2 [[a, b], [b, d]]. */
function eig2(a, b, d) {
  const m = (a + d) / 2, r = Math.hypot((a - d) / 2, b);
  return [m + r, m - r].map(lam => {
    const v = Math.abs(b) > 1e-12 ? [b, lam - a] : (a >= d) === (lam === m + r)
      ? [1, 0] : [0, 1];
    const n = norm(v);
    return { lam, v: [v[0] / n, v[1] / n] };
  });
}

const PCA_S = [[3, 1], [1, 2]];
const PCA_EIG = eig2(PCA_S[0][0], PCA_S[0][1], PCA_S[1][1]);
const W_DIR = [2, 1];

const PRESETS = [
  {
    id: "circle",
    label: "Saddle on a circle",
    startU: 0.35,
    build: () => ({
      ...ON_CIRCLE,
      f: x => x[0] * x[1],
      gradF: x => [x[1], x[0]],
      sols: [
        { x: [R2, R2], lam: 0.5, kind: "max" },
        { x: [-R2, -R2], lam: 0.5, kind: "max" },
        { x: [R2, -R2], lam: -0.5, kind: "min" },
        { x: [-R2, R2], lam: -0.5, kind: "min" },
      ],
    }),
    html: {
      title: "Saddle on a circle",
      problem: `Find the largest and smallest <i>f</i>(${BX}) =
        ${X0}${X1} on the unit circle ${X0}<sup>2</sup> +
        ${X1}<sup>2</sup> = 1. On its own <i>f</i> is a saddle with no max
        or min; the constraint creates them.`,
      system: `${X1} = 2${LAM}${X0} ${SEP} ${X0} = 2${LAM}${X1} ${SEP}
        ${X0}<sup>2</sup> + ${X1}<sup>2</sup> = 1`,
      solution: `Multiply the first equation by ${X0} and the second by
        ${X1}: both left sides become ${X0}${X1}, so
        2${LAM}${X0}<sup>2</sup> = 2${LAM}${X1}<sup>2</sup>. ${LAM} = 0
        would force ${BX} = <b>0</b>, which is off the circle, so
        ${X0}<sup>2</sup> = ${X1}<sup>2</sup> = 1/2 and ${X0} = &plusmn;${X1}
        = &plusmn;1/&radic;2. Then ${LAM} = ${X1} / (2${X0}) = &plusmn;1/2.
        Same signs: the max, <i>f</i> = 1/2 (${LAM} = 1/2). Opposite signs:
        the min, <i>f</i> = &minus;1/2 (${LAM} = &minus;1/2).`,
      try: [
        `Switch to 3D. Which points of the path lifted onto the surface
          are the answers?
          <details class="answer"><summary>Answer</summary>Its two highest
          and two lowest points. The surface itself is a saddle, so its
          only flat point, <b>0</b>, is neither.</details>`,
      ],
    },
  },
  {
    id: "line",
    label: "Closest point on a line",
    startU: -1.6,
    build: () => {
      const view = { mid: [1.2, 1.2], hw: 2.2 };
      return {
        f: x => x[0] ** 2 + x[1] ** 2,
        gradF: x => [2 * x[0], 2 * x[1]],
        g: x => 3 * x[0] + 4 * x[1] - 10,
        gradG: () => [3, 4],
        gSym: "g",
        path: lineInView([1.2, 1.6], [-0.8, 0.6], view),
        view,
        sols: [{ x: [1.2, 1.6], lam: 0.8, kind: "min" }],
      };
    },
    html: {
      title: "Closest point on a line",
      problem: `Find the point of the line 3${X0} + 4${X1} = 10 closest
        to the origin. Minimize the squared distance <i>f</i>(${BX}) =
        ${X0}<sup>2</sup> + ${X1}<sup>2</sup>: it has the same minimizer as
        the distance and a simpler gradient. The line is ${BW} &middot; ${BX}
        = <i>b</i> with ${BW} = (3, 4) and <i>b</i> = 10.`,
      system: `2${X0} = 3${LAM} ${SEP} 2${X1} = 4${LAM} ${SEP}
        3${X0} + 4${X1} = 10`,
      solution: `The first two say ${BX} = (${LAM}/2)(3, 4): the answer is
        a multiple of ${BW}. Put it in the constraint: (${LAM}/2)(9 + 16)
        = 10, so ${LAM} = 0.8 and ${BX} = (1.2, 1.6), at distance
        &radic;(1.44 + 2.56) = 2 from the origin. In general ${BX} =
        <i>b</i>${BW} / &Vert;${BW}&Vert;<sup>2</sup>, at distance <i>b</i> /
        &Vert;${BW}&Vert;: the margin of the SVM lesson.`,
      try: [
        `The circle had four critical points. Why does this have one?
          <details class="answer"><summary>Answer</summary>The line runs
          off in both directions and <i>f</i> grows without bound along it:
          there is a min but no max. The plot of <i>f</i> along the path is
          a parabola.</details>`,
      ],
    },
  },
  {
    id: "direction",
    label: "Best direction",
    startU: 2.2,
    build: () => {
      const n = norm(W_DIR), v = [W_DIR[0] / n, W_DIR[1] / n];
      return {
        ...ON_CIRCLE,
        f: x => dot(W_DIR, x),
        gradF: () => W_DIR.slice(),
        sols: [
          { x: v, lam: n / 2, kind: "max" },
          { x: [-v[0], -v[1]], lam: -n / 2, kind: "min" },
        ],
      };
    },
    html: {
      title: "Best direction",
      problem: `Which unit vector ${BX} (&Vert;${BX}&Vert; = 1) makes
        ${BW} &middot; ${BX} largest, for ${BW} = (2, 1)? Here <i>f</i>(${BX})
        = 2${X0} + ${X1} is linear, so its level sets are straight
        lines.`,
      system: `2 = 2${LAM}${X0} ${SEP} 1 = 2${LAM}${X1} ${SEP}
        ${X0}<sup>2</sup> + ${X1}<sup>2</sup> = 1`,
      solution: `The first two say ${BX} = ${BW} / (2${LAM}), a multiple
        of ${BW}. Unit length forces 2${LAM} = &plusmn;&Vert;${BW}&Vert; =
        &plusmn;&radic;5, so ${BX} = &plusmn;${BW} / &Vert;${BW}&Vert; =
        &plusmn;(0.894, 0.447) and ${LAM} = &plusmn;&radic;5 / 2 &asymp;
        &plusmn;1.12. The max, <i>f</i> = &radic;5, is at ${BX} = ${BW} /
        &Vert;${BW}&Vert;: of all directions, ${BW} &middot; ${BX} grows
        fastest along ${BW}. With ${BW} = &nabla;<i>f</i>, that is why the
        gradient is the steepest way uphill.`,
      try: [
        `Walk to the max with the level set through the point turned on.
          How does that line meet the circle?
          <details class="answer"><summary>Answer</summary>It just touches
          it. A larger value of <i>f</i> gives a parallel line that misses
          the circle; a smaller one cuts through it twice.</details>`,
      ],
    },
  },
  {
    id: "pca",
    label: "Max variance (PCA)",
    startU: 0.2,
    build: () => {
      const [S0, S1] = PCA_S;
      const [top, bot] = PCA_EIG;
      const neg = v => [-v[0], -v[1]];
      return {
        ...ON_CIRCLE,
        f: x => S0[0] * x[0] ** 2 + 2 * S0[1] * x[0] * x[1]
          + S1[1] * x[1] ** 2,
        gradF: x => [2 * (S0[0] * x[0] + S0[1] * x[1]),
          2 * (S1[0] * x[0] + S1[1] * x[1])],
        sols: [
          { x: top.v, lam: top.lam, kind: "max" },
          { x: neg(top.v), lam: top.lam, kind: "max" },
          { x: bot.v, lam: bot.lam, kind: "min" },
          { x: neg(bot.v), lam: bot.lam, kind: "min" },
        ],
      };
    },
    html: {
      title: "Max variance direction (PCA)",
      problem: `For <i>&Sigma;</i> = <span class="mat"><span>3</span><span>1</span><span>1</span><span>2</span></span>,
        find the unit vector ${BX} with the largest <i>f</i>(${BX}) =
        ${BX}<sup>&#8868;</sup><i>&Sigma;</i>${BX} = 3${X0}<sup>2</sup> +
        2${X0}${X1} + 2${X1}<sup>2</sup>. In PCA (lesson 19) <i>&Sigma;</i>
        is the data's covariance and <i>f</i> is the variance of the data
        projected onto ${BX}.`,
      system: `2<i>&Sigma;</i>${BX} = ${LAM} &middot; 2${BX} ${SEP}
        ${X0}<sup>2</sup> + ${X1}<sup>2</sup> = 1`,
      solution: `&nabla;<i>f</i> = 2<i>&Sigma;</i>${BX} and &nabla;<i>g</i>
        = 2${BX}, so the rule reads <i>&Sigma;</i>${BX} = ${LAM}${BX}:
        ${BX} is an eigenvector of <i>&Sigma;</i> and ${LAM} its
        eigenvalue. Then <i>f</i> = ${BX}<sup>&#8868;</sup><i>&Sigma;</i>${BX}
        = ${LAM}${BX}<sup>&#8868;</sup>${BX} = ${LAM}. The eigenvalues are
        (5 &plusmn; &radic;5) / 2: the max <i>f</i> = 3.62 at ${BX} =
        &plusmn;(0.851, 0.526), the min <i>f</i> = 1.38 at ${BX} =
        &plusmn;(0.526, &minus;0.851).`,
      try: [
        `Read ${LAM} at each critical point and compare it with <i>f</i>.
          <details class="answer"><summary>Answer</summary>They are equal
          at every one, since <i>f</i> = ${LAM}${BX}<sup>&#8868;</sup>${BX}
          = ${LAM} on the circle. The largest variance is the top
          eigenvalue.</details>`,
      ],
    },
  },
  {
    id: "budget",
    label: "Spending a budget",
    startU: 0.25,
    slider: { name: "Budget <i>B</i>", min: 2, max: 8, step: 0.5,
      value: 6, tip: "Dollars to spend. The first good costs $1 a unit, the "
        + "second $2." },
    build: B => {
      const eps = 1e-9, r = v => Math.sqrt(Math.max(v, 0));
      const lam = Math.sqrt(3 / (8 * B));
      return {
        f: x => r(x[0]) + r(x[1]),
        gradF: x => [0.5 / r(Math.max(x[0], eps)),
          0.5 / r(Math.max(x[1], eps))],
        g: x => x[0] + 2 * x[1] - B,
        gradG: () => [1, 2],
        gSym: "g",
        path: { closed: false, u0: 0.01, u1: 0.99,
          pos: u => [B * (1 - u), B * u / 2] },
        view: { mid: [4, 4], hw: 4.4 },
        sols: [{ x: [2 * B / 3, B / 6], lam, kind: "max" }],
      };
    },
    sweep: {
      title: "Best <i>f</i>* against the budget",
      xlabel: "budget B", ylabel: "best f*",
      y: B => Math.sqrt(1.5 * B),
      slope: B => Math.sqrt(3 / (8 * B)),
      note: B => `slope d<i>f</i>*/d<i>B</i> = ${LAM} = ${
        fmt(Math.sqrt(3 / (8 * B)))}`,
    },
    html: {
      title: "Spending a budget",
      problem: `Spend <i>B</i> dollars on two goods: ${X0} units at $1
        each and ${X1} units at $2 each. Happiness is <i>f</i>(${BX}) =
        &radic;${X0} + &radic;${X1}, so each extra unit helps a bit less.
        Maximize <i>f</i> on the budget line ${X0} + 2${X1} = <i>B</i>.`,
      system: `1 / (2&radic;${X0}) = ${LAM} ${SEP} 1 / (2&radic;${X1}) =
        2${LAM} ${SEP} ${X0} + 2${X1} = <i>B</i>`,
      solution: `The first two give ${X0} = 1 / (4${LAM}<sup>2</sup>) and
        ${X1} = 1 / (16${LAM}<sup>2</sup>). The budget then reads
        3 / (8${LAM}<sup>2</sup>) = <i>B</i>, so ${LAM} = &radic;(3 / 8<i>B</i>),
        ${BX} = (2<i>B</i>/3, <i>B</i>/6) and the best happiness is
        <i>f</i>* = &radic;(3<i>B</i>/2). Here ${LAM} has a meaning:
        d<i>f</i>*/d<i>B</i> = ${LAM}, what one more dollar is worth in
        happiness.`,
      try: [
        `At <i>B</i> = 6, read ${LAM}. Then raise <i>B</i> to 7: how much
          does the best <i>f</i> grow?
          <details class="answer"><summary>Answer</summary>${LAM} = 0.25.
          The best <i>f</i> goes from 3 to 3.24, up 0.24 &asymp; ${LAM}. As
          <i>B</i> grows ${LAM} shrinks: each extra dollar buys less
          happiness.</details>`,
      ],
    },
  },
  {
    id: "ineq",
    label: "Inequality: active?",
    startU: 1.0,
    slider: { name: "Limit <i>c</i>", min: 0, max: 6, step: 0.25, value: 2,
      tip: "The constraint is x0 + x1 ≤ c. Small c pushes the feasible "
        + "side away from (2, 2)." },
    build: c => {
      const view = { mid: [2, 2], hw: 3 };
      const active = c < 4;
      return {
        f: x => (x[0] - 2) ** 2 + (x[1] - 2) ** 2,
        gradF: x => [2 * (x[0] - 2), 2 * (x[1] - 2)],
        g: x => c - x[0] - x[1],
        gradG: () => [-1, -1],
        gSym: "h",
        ineq: true,
        path: lineInView([c / 2, c / 2], [-R2, R2], view),
        view,
        veil: clipHalf(viewSquare(view), [1, 1], c),
        free: [2, 2],
        sols: [active
          ? { x: [c / 2, c / 2], lam: 4 - c, kind: "min" }
          : { x: [2, 2], lam: 0, kind: "min", inside: c > 4 }],
      };
    },
    sweep: {
      title: "<i>&lambda;</i> against the limit <i>c</i>",
      xlabel: "limit c", ylabel: "λ",
      y: c => Math.max(0, 4 - c),
      note: c => c < 4
        ? `${LAM} = 4 &minus; <i>c</i> = ${fmt(4 - c)}: active`
        : `${LAM} = 0: inactive`,
    },
    html: {
      title: "Inequality: active or inactive?",
      problem: `Minimize <i>f</i>(${BX}) = (${X0} &minus; 2)<sup>2</sup> +
        (${X1} &minus; 2)<sup>2</sup> subject to ${X0} + ${X1} &le;
        <i>c</i>, written <i>h</i>(${BX}) = <i>c</i> &minus; ${X0} &minus;
        ${X1} &ge; 0 (the gray side is infeasible). There are two cases.
        Inactive: the unconstrained min (2, 2) is feasible, and ${LAM} = 0.
        Active: the min is on the line <i>h</i> = 0; solve it as an
        equality and keep it only if ${LAM} &ge; 0.`,
      system: `2(${X0} &minus; 2) = &minus;${LAM} ${SEP} 2(${X1} &minus; 2)
        = &minus;${LAM} ${SEP} ${X0} + ${X1} = <i>c</i>`,
      solution: `Active case: ${X0} = ${X1} = <i>c</i>/2 and ${LAM} = 4
        &minus; <i>c</i>. For <i>c</i> = 2: ${BX} = (1, 1) with ${LAM} = 2
        &ge; 0, so the constraint is active and this is the min. For
        <i>c</i> = 5: ${LAM} = &minus;1 &lt; 0, so that boundary point is
        not the min. The unconstrained min (2, 2) is feasible (2 + 2 &le;
        5): the constraint is inactive and ${LAM} = 0. ${LAM} &ge; 0 says
        &nabla;<i>f</i> points into the feasible side, so <i>f</i> could
        only fall by leaving it.`,
      try: [
        `Slide <i>c</i> from 0 to 6. Where does ${LAM} reach 0, and what
          happens after?
          <details class="answer"><summary>Answer</summary>At <i>c</i> = 4
          the boundary reaches (2, 2). Past it the constraint is inactive:
          the min stays at (2, 2) and ${LAM} stays 0, the kink in the
          chart.</details>`,
        `Set <i>c</i> = 5 and walk the point to where the two rows agree
          on ${LAM}. Why is that point not the answer?
          <details class="answer"><summary>Answer</summary>There ${LAM} =
          &minus;1 &lt; 0: &nabla;<i>f</i> points out of the feasible side,
          so stepping into it lowers <i>f</i>. The min is inside, at
          (2, 2).</details>`,
      ],
    },
  },
];

const PRESET = Object.fromEntries(PRESETS.map(p => [p.id, p]));
