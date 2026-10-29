// Constrained problems for both tabs: an objective f, one constraint, the
// path the constraint leaves to walk on, and the known solutions.
//
// Each preset's build(p) takes its slider value (when it has a slider)
// and returns
//
//   { f(x), gradF(x), g(x), gradG(x), gSym,
//     path: { closed, u0, u1, pos(u) },
//     view: { mid: [m0, m1], hw }, view3?: the same, for the 3D mesh,
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
// items, with answers). The solution is a list of parts: { tex } a
// displayed derivation, { p } a paragraph and { answer } the closing
// answer, both with $...$ inline TeX (rendered by KaTeX).

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
  view: { mid: [0, 0], hw: 1.6 },
  view3: { mid: [0, 0], hw: 1.25 },
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
      solution: [
        { tex: String.raw`\begin{aligned}
          x_0 x_1 &= 2\lambda x_0^2 = 2\lambda x_1^2 \\
          x_0^2 &= x_1^2 = \tfrac{1}{2} \\
          \mathbf{x} &= \left(\pm\tfrac{1}{\sqrt{2}},\ \pm\tfrac{1}{\sqrt{2}}\right) \\
          \lambda &= \frac{x_1}{2x_0} = \pm\tfrac{1}{2} \\
          f(\mathbf{x}) &= x_0 x_1 = \pm\tfrac{1}{2}
          \end{aligned}` },
        { p: String.raw`The first line multiplies the first condition by
          $x_0$ and the second by $x_1$. The second divides by $2\lambda$
          ($\lambda = 0$ would force $\mathbf{x} = \mathbf{0}$, off the
          circle) and uses $x_0^2 + x_1^2 = 1$.` },
        { answer: String.raw`the max $f = \tfrac{1}{2}$ is at
          $\pm\left(\tfrac{1}{\sqrt{2}},\ \tfrac{1}{\sqrt{2}}\right)$ with
          $\lambda = \tfrac{1}{2}$; the min $f = -\tfrac{1}{2}$ is at
          $\pm\left(\tfrac{1}{\sqrt{2}},\ -\tfrac{1}{\sqrt{2}}\right)$ with
          $\lambda = -\tfrac{1}{2}$.` },
      ],
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
        + <i>b</i> = 0 with ${BW} = (3, 4) and <i>b</i> = &minus;10.`,
      system: `2${X0} = 3${LAM} ${SEP} 2${X1} = 4${LAM} ${SEP}
        3${X0} + 4${X1} = 10`,
      solution: [
        { tex: String.raw`\begin{aligned}
          \mathbf{x} &= \tfrac{\lambda}{2}\,(3,\ 4) \\
          3 \cdot \tfrac{3\lambda}{2} + 4 \cdot \tfrac{4\lambda}{2} &= 10 \\
          \tfrac{25}{2}\,\lambda &= 10 \\
          \lambda &= 0.8 \\
          \mathbf{x} &= 0.4\,(3,\ 4) = (1.2,\ 1.6) \\
          \|\mathbf{x}\| &= \sqrt{1.2^2 + 1.6^2} = \sqrt{4} = 2
          \end{aligned}` },
        { p: String.raw`The first line solves the two gradient conditions
          for $\mathbf{x}$; the second substitutes it into the
          constraint.` },
        { answer: String.raw`the closest point is
          $\mathbf{x} = (1.2,\ 1.6)$, at distance 2, with $\lambda = 0.8$.
          In general the point of $\mathbf{w} \cdot \mathbf{x} + b = 0$
          closest to the origin is $-b\,\mathbf{w} / \|\mathbf{w}\|^2$, at
          distance $|b| / \|\mathbf{w}\|$: the SVM lesson's distance
          $|\mathbf{w} \cdot \mathbf{x} + b| / \|\mathbf{w}\|$ at
          $\mathbf{x} = \mathbf{0}$.` },
      ],
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
    label: "Best direction (LDA)",
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
      title: "Best direction (LDA)",
      problem: `Two classes have means <b>&mu;</b><sub>0</sub> and
        <b>&mu;</b><sub>1</sub>. Project the data onto a unit vector ${BX}
        (&Vert;${BX}&Vert; = 1): which ${BX} pushes the projected means
        furthest apart? Maximize <i>f</i>(${BX}) =
        (<b>&mu;</b><sub>1</sub> &minus; <b>&mu;</b><sub>0</sub>) &middot;
        ${BX}, with <b>&mu;</b><sub>1</sub> &minus; <b>&mu;</b><sub>0</sub>
        = (2, 1). This is LDA when each class spreads equally in every
        direction; full LDA also divides by the spread within each class
        (Fisher 1936).`,
      system: `2 = 2${LAM}${X0} ${SEP} 1 = 2${LAM}${X1} ${SEP}
        ${X0}<sup>2</sup> + ${X1}<sup>2</sup> = 1`,
      solution: [
        { tex: String.raw`\begin{aligned}
          \mathbf{x} &= \tfrac{1}{2\lambda}\,(2,\ 1) \\
          \|\mathbf{x}\|^2 = \tfrac{1}{4\lambda^2}\,(2^2 + 1^2) &= 1 \\
          \lambda &= \pm\tfrac{\sqrt{5}}{2} \\
          \mathbf{x} &= \pm\tfrac{1}{\sqrt{5}}\,(2,\ 1)
            = \pm(0.894,\ 0.447) \\
          f(\mathbf{x}) &= \pm\tfrac{1}{\sqrt{5}}\,(2 \cdot 2 + 1)
            = \pm\sqrt{5}
          \end{aligned}` },
        { p: String.raw`The first line solves the two gradient conditions
          for $\mathbf{x}$; the second substitutes it into the
          constraint.` },
        { answer: String.raw`the max $f = \sqrt{5} \approx 2.24$ is at
          $\mathbf{x} = (\boldsymbol{\mu}_1 - \boldsymbol{\mu}_0) /
          \|\boldsymbol{\mu}_1 - \boldsymbol{\mu}_0\|$ with
          $\lambda = \tfrac{\sqrt{5}}{2}$; the min $f = -\sqrt{5}$ is at
          the opposite unit vector. The best direction is the
          difference of the class means itself.` },
      ],
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
      solution: [
        { tex: String.raw`\begin{aligned}
          2\Sigma\mathbf{x} &= 2\lambda\mathbf{x} \\
          \Sigma\mathbf{x} &= \lambda\mathbf{x} \\
          \det(\Sigma - \lambda I) = (3 - \lambda)(2 - \lambda) - 1
            = \lambda^2 - 5\lambda + 5 &= 0 \\
          \lambda &= \tfrac{5 \pm \sqrt{5}}{2} = 3.62 \text{ or } 1.38 \\
          x_1 &= (\lambda - 3)\, x_0 \\
          f(\mathbf{x}) = \mathbf{x}^\top \Sigma \mathbf{x}
            = \lambda\, \mathbf{x}^\top \mathbf{x} &= \lambda
          \end{aligned}` },
        { p: String.raw`The first line is $\nabla f = \lambda \nabla g$
          with $\nabla f = 2\Sigma\mathbf{x}$ and $\nabla g = 2\mathbf{x}$,
          so $\mathbf{x}$ is an eigenvector of $\Sigma$ and $\lambda$ its
          eigenvalue. The fifth line is the first row of
          $(\Sigma - \lambda I)\mathbf{x} = \mathbf{0}$, and the last uses
          $\mathbf{x}^\top \mathbf{x} = 1$.` },
        { answer: String.raw`the max $f = 3.62$ is at
          $\mathbf{x} = \pm(0.851,\ 0.526)$ and the min $f = 1.38$ at
          $\mathbf{x} = \pm(0.526,\ -0.851)$: the largest variance is the
          top eigenvalue, along its eigenvector.` },
      ],
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
      solution: [
        { tex: String.raw`\begin{aligned}
          x_0 &= \tfrac{1}{4\lambda^2}, \qquad x_1 = \tfrac{1}{16\lambda^2} \\
          x_0 + 2x_1 = \tfrac{1}{4\lambda^2} + \tfrac{2}{16\lambda^2}
            = \tfrac{3}{8\lambda^2} &= B \\
          \lambda &= \sqrt{\tfrac{3}{8B}} \\
          \mathbf{x} &= \left(\tfrac{2B}{3},\ \tfrac{B}{6}\right) \\
          f^* = \sqrt{\tfrac{2B}{3}} + \sqrt{\tfrac{B}{6}}
            &= \sqrt{\tfrac{3B}{2}} \\
          \frac{df^*}{dB} = \tfrac{1}{2}\sqrt{\tfrac{3}{2B}}
            &= \sqrt{\tfrac{3}{8B}} = \lambda
          \end{aligned}` },
        { p: String.raw`The first line solves the two gradient conditions;
          the second substitutes them into the budget; the last two compute
          the best happiness $f^*$ and its derivative.` },
        { answer: String.raw`at $B = 6$, $\mathbf{x} = (4,\ 1)$,
          $f^* = 3$ and $\lambda = 0.25$. Since $\lambda = df^*/dB$, it is
          what one more dollar of budget is worth in happiness.` },
      ],
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
      solution: [
        { p: String.raw`First suppose the constraint is active, so the min
          is on the boundary $h(\mathbf{x}) = 0$:` },
        { tex: String.raw`\begin{aligned}
          x_0 &= x_1 = 2 - \tfrac{\lambda}{2} \\
          x_0 + x_1 = 4 - \lambda &= c \\
          \lambda &= 4 - c, \qquad
            \mathbf{x} = \left(\tfrac{c}{2},\ \tfrac{c}{2}\right)
          \end{aligned}` },
        { p: String.raw`The first line solves the two gradient conditions
          ($\nabla h = (-1,\ -1)$); the second substitutes into the boundary
          $x_0 + x_1 = c$. The active solution counts only if
          $\lambda \ge 0$:` },
        { tex: String.raw`\lambda = 4 - c \;
          \begin{cases}
            \ge 0 \text{ for } c \le 4: & \text{active, }
              \mathbf{x}^* = \left(\tfrac{c}{2},\ \tfrac{c}{2}\right) \\
            < 0 \text{ for } c > 4: & \text{inactive, }
              \mathbf{x}^* = (2,\ 2),\ \lambda = 0
          \end{cases}` },
        { p: String.raw`For $c > 4$ the unconstrained min $(2,\ 2)$ is
          feasible ($2 + 2 \le c$), so it is the answer.` },
        { answer: String.raw`for $c = 2$, $\mathbf{x}^* = (1,\ 1)$ with
          $\lambda = 2$; for $c = 5$, $\mathbf{x}^* = (2,\ 2)$ with
          $\lambda = 0$.` },
      ],
      try: [
        `Slide <i>c</i> from 0 to 6. Where does ${LAM} reach 0, and what
          happens after?
          <details class="answer"><summary>Answer</summary>At <i>c</i> = 4
          the boundary reaches (2, 2). Past it the constraint is inactive:
          the min stays at (2, 2) and ${LAM} stays 0, the kink in the
          chart.</details>`,
        `Set <i>c</i> = 5 and walk the point to where &nabla;<i>f</i>
          lines up with &nabla;<i>h</i>. What is ${LAM} there, and why is
          that point not the answer?
          <details class="answer"><summary>Answer</summary>There ${LAM} =
          &minus;1 &lt; 0: &nabla;<i>f</i> points out of the feasible side,
          so stepping into it lowers <i>f</i>. The min is inside, at
          (2, 2).</details>`,
      ],
    },
  },
];

const PRESET = Object.fromEntries(PRESETS.map(p => [p.id, p]));
