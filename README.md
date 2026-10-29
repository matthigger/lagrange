# lagrange

**Live demo:** <https://matthigger.github.io/lagrange/>

Interactive teaching demo of Lagrange multipliers in 2D, in the style of
the [gradient descent](https://matthigger.github.io/gradient_descent/) and
[logistic regression](https://matthigger.github.io/logistic_regression/)
demos. Written for DS4400 lesson 15. Two tabs:

- **Walk the constraint** (`#walk`). Builds the rule ∇f = λ∇g in three
  steps: walking perpendicular to ∇f leaves f unchanged; ∇g is always
  perpendicular to the path (else g would change along it); so where ∇f
  lines up with ∇g, walking along the path doesn't change f. f = x₀x₁ on
  the unit circle. A point is dragged along the path (it snaps onto a
  solution when close). At the point: ∇f, ∇g, and in red the part of ∇f
  along the path. Beside it, the path unrolled: f against arc length s,
  with its tangent line. Climb / Descend walk the point along the red
  arrow until it vanishes. The readout says whether f is rising or flat
  along the path and whether ∇f = λ∇g, with λ. One toggle marks the
  solutions.
- **In practice** (`#examples`). Six presets, each with its Lagrange
  system and a worked solution: the circle above; the closest point on a
  line (the SVM margin); the best unit direction (μ₁ − μ₀) · x (LDA
  with round classes); max variance xᵀΣx on the circle (PCA: eigenvectors, λ = f);
  a budget (a slider on B, with f*(B) whose slope is λ); and an
  inequality x₀ + x₁ ≤ c (a slider on c, the infeasible side hatched,
  λ against c with its kink where the constraint turns inactive).

Both tabs have a Contour / 3D toggle: the 3D view is an orbitable mesh
of f with the path drawn on the floor and lifted onto the surface.

Plain HTML/CSS/JS with SVG and no build step. The one dependency is
KaTeX (from jsdelivr, pinned) for the worked solutions; without it they
show raw TeX.

## Run locally

Open `index.html` in a browser, or serve it:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Publish on GitHub Pages

Pages is built by `.github/workflows/pages.yml` on every push to `main`. It
stamps `js/version.js` with the commit and build time, which the footer
shows ("local copy" when run locally).

## Layout

| file | role |
|------|------|
| `index.html` | page, Walk tab text, controls |
| `style.css` | layout, palette, plot styles |
| `js/util.js` | SVG helpers, formatting, ticks, marching squares |
| `js/problems.js` | the presets: f, g, path, solutions, page text |
| `js/path.js` | `PathTable`: arc length, tangents, nearest point |
| `js/surface.js` | `SurfView`: contour map and 3D mesh with the path |
| `js/pathplot.js` | `PathPlot` (f along the path), `SweepChart` |
| `js/explorer.js` | `Explorer`: one tab's state, readout, Climb |
| `js/app.js` | tabs, hash routing, arrow keys, footer build stamp |
| `js/version.js` | build stamp, overwritten at deploy |
| `design/spec.md` | the design spec |
| `.github/workflows/pages.yml` | Pages deploy |
