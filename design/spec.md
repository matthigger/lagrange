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
- The readout shows λ from each row of ∇f = λ∇g, not just the angle: the
  two rows asking for different λ is the reason no λ exists. λ's sign is
  shown; the Walk tab explains it means nothing for an equality, and the
  inequality preset uses it (λ ≥ 0).
- Arc length s, not the curve parameter, on the unrolled plot, so its
  slope is exactly u · ∇f, the red arrow's length.
- Contour / 3D toggle on both tabs (as in `gradient_descent`): sampled
  mesh under an orthographic orbit camera, Lambert-shaded, path on the
  floor and lifted onto the surface; the gradients stay on the floor.
- Inequality lives in the last preset, not its own tab. Its constraint is
  written h(x) = c − x₀ − x₁ ≥ 0 so that an active min has λ ≥ 0.
- Cut: typing in your own f and g, more than one constraint (KKT is only
  named in class), the 1D warm-up min x² s.t. x ≥ ±1.

## Tab 1: Walk the constraint (`#walk`)

f = x₀x₁ on x₀² + x₁² = 1 (the lecture's worked example). Intro: the
problem (∇f = 0 fails on a path), the three-step argument, the rule and the
equation count. Try this: find the four points where the red arrow
vanishes; Climb from several starts; ∇g against the level sets of g; λ's
sign at a max and a min; the 3D saddle.

Controls: Climb / Descend (projected gradient ascent / descent along the
path, animated, stopping where u · ∇f = 0 or at an open path's end), split
∇f along / across (on), level set of f through the point (on), level sets
of g (off), mark the solutions (off). ← / → step the point by 1% of the
path.

## Tab 2: In practice (`#examples`)

Same explorer, solutions marked by default, a preset picker, and per
preset an intro (problem, system, worked solution, one or two Try this
items).

| preset | constraint | shows |
|---|---|---|
| Saddle on a circle | unit circle | the lecture example, solved |
| Closest point on a line | 3x₀ + 4x₁ = 10 | ICA 1; x = bw/‖w‖², the SVM margin |
| Best direction | unit circle | max w · x at w/‖w‖ |
| Max variance (PCA) | unit circle | Σx = λx, λ = f (lesson 19) |
| Spending a budget | x₀ + 2x₁ = B, slider B ∈ [2, 8] | λ = df*/dB, chart of f*(B) |
| Inequality: active? | x₀ + x₁ ≤ c, slider c ∈ [0, 6] | ICA 2; λ = max(0, 4 − c), chart of λ(c) |
