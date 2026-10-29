# Lagrange multipliers, visually: spec

Sibling of `gradient_descent`, `logistic_regression` and
`regularized_regression`: plain HTML/CSS/JS with SVG, the same page shell
(header + tabs, intro card with formulas and "Try this" with `<details>`
answers, plot cards + controls sidebar, footer build stamp) and
`pages.yml`. Written for lesson 15 (`DS4400/notes/day15_lagrange/
plan_lagrange_svm.md`); the Walk tab replaces `lagrange_circle.html` in
class.

## Decisions

- Follows the lesson: ∇f = λ∇g plus the constraint, no Lagrangian.
- 2D only: x = (x₀, x₁), so f is drawable as a contour map or a surface.
- Colors: f and ∇f violet, the constraint and ∇g teal, the part of ∇f
  along the path red.
- ∇f and ∇g are drawn to one common scale per problem, so at a solution
  ∇f is visibly λ times ∇g.
- The point always lies on the path. Dragging anywhere (contour) moves it
  to the nearest path point on screen; it snaps onto a known solution
  within 1.2% of the path length, so the readout can show exact
  agreement.
- Kept simple: no ⟂ symbol (the words "perpendicular" and "line up"),
  no u · ∇f notation, a short readout (the two gradients, whether f is
  rising or flat along the path, and ∇f = λ∇g with λ when they line up).
  λ's sign is shown; the inequality preset uses it (λ ≥ 0).
- Arc length s, not the curve parameter, on the unrolled plot, so its
  slope is exactly the red arrow's (signed) length.
- Contour / 3D toggle on both tabs (as in `gradient_descent`): sampled
  mesh under an orthographic orbit camera, Lambert-shaded, path on the
  floor and lifted onto the surface; the gradients stay on the floor. The
  mesh may cover a tighter square than the contour map (view3), so its
  height follows f near the path.
- Inequality lives in the last preset, not its own tab. Its constraint is
  written h(x) = c − x₀ − x₁ ≥ 0 so that an active min has λ ≥ 0.
- Cut: typing in your own f and g, more than one constraint (KKT is only
  named in class), the 1D warm-up min x² s.t. x ≥ ±1.

## Tab 1: Walk the constraint (`#walk`)

f = x₀x₁ on x₀² + x₁² = 1 (the lecture's worked example). Intro: the
problem, then three steps. (1) Along ∇f, f goes up; against it, down;
perpendicular to it, unchanged. (2) ∇g is always perpendicular to the
path, else g would change along it. (3) Where ∇f and ∇g line up, ∇f is
perpendicular to the path too, so f doesn't change along it: a
constrained max or min. Then the rule. Try this: find the four points
where the red arrow vanishes; Climb from a few starts; the 3D saddle.

Controls: Climb / Descend (projected gradient ascent / descent along the
path, animated, stopping where the red arrow vanishes or at an open
path's end) and mark the solutions (off). ← / → step the point by 1% of the
path.

## Tab 2: In practice (`#examples`)

Same explorer, solutions marked by default, a full-width preset picker
as the first box under the tabs, and per preset an intro (problem,
system, worked solution, one or two Try this items). Worked solutions are
typeset with KaTeX (the page's one dependency, pinned on jsdelivr) in the
course's solution style: one aligned derivation with every step, one
sentence naming the steps, then the answer.

| preset | constraint | shows |
|---|---|---|
| Saddle on a circle | unit circle | the lecture example, solved |
| Closest point on a line | 3x₀ + 4x₁ = 10 | ICA 1; w · x + b = 0 with b = −10, x = −bw/‖w‖², distance \|b\|/‖w‖ |
| Best direction (LDA) | unit circle | max (μ₁ − μ₀) · x at (μ₁ − μ₀)/‖μ₁ − μ₀‖ (LDA with round classes) |
| Max variance (PCA) | unit circle | Σx = λx, λ = f (lesson 19) |
| Spending a budget | x₀ + 2x₁ = B, slider B ∈ [2, 8] | λ = df*/dB, chart of f*(B) |
| Inequality: active? | x₀ + x₁ ≤ c, slider c ∈ [0, 6] | ICA 2; λ = max(0, 4 − c), chart of λ(c) |
