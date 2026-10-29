// Shared helpers: SVG nodes, pointer coordinates, number formatting,
// arrows, ticks and small vector math.

const SVGNS = "http://www.w3.org/2000/svg";

function node(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function text(parent, x, y, str, attrs = {}) {
  const t = node("text", { x, y, ...attrs }, parent);
  t.textContent = str;
  return t;
}

/** Pointer position in the viewBox units of an SVG. */
function svgPoint(svg, e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵",
  6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

/** Three significant digits; powers of ten outside 0.001..99999. */
function fmt(v, digits = 3) {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "—";
  const a = Math.abs(v);
  if (a < 1e-9) return "0";
  if (a >= 1e5 || a < 1e-3) {
    const [m, e] = v.toExponential(digits - 1).split("e");
    const exp = String(+e).split("").map(ch => SUP[ch]).join("");
    return `${m.replace("-", "−")}×10${exp}`;
  }
  return String(+v.toPrecision(digits)).replace("-", "−");
}

/** Column vector (HTML) of already-formatted entries, in brackets. */
function colVec(entries) {
  return `<span class="colvec">${
    entries.map(e => `<span>${e}</span>`).join("")}</span>`;
}

function fmtCol(v) { return colVec(v.map(x => fmt(x))); }

/** A point as "(a, b)". */
function fmtPt(x) { return `(${fmt(x[0])}, ${fmt(x[1])})`; }

/** Arrow from (x1, y1) to (x2, y2) in screen units; skipped if too short. */
function arrow(parent, x1, y1, x2, y2, cls, head = 9) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const g = node("g", { class: cls }, parent);
  if (len < 1) return g;
  const ux = dx / len, uy = dy / len;
  const h = Math.min(head, len * 0.6);
  node("line", { x1, y1, x2: x2 - ux * h * 0.8, y2: y2 - uy * h * 0.8 }, g);
  const bx = x2 - ux * h, by = y2 - uy * h;
  node("polygon", { points: [
    `${x2},${y2}`,
    `${bx - uy * h * 0.5},${by + ux * h * 0.5}`,
    `${bx + uy * h * 0.5},${by - ux * h * 0.5}`].join(" ") }, g);
  return g;
}

/** Roughly n round tick values covering [lo, hi]. */
function ticks(lo, hi, n = 5) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(f => f * mag).find(s => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9;
    v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function norm(a) { return Math.hypot(a[0], a[1]); }
function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }

/** Marching-squares level-L segments of a (n+1)^2 grid, screen units. */
function march(z, n, L, X, Y) {
  const segs = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = z[j * (n + 1) + i], b = z[j * (n + 1) + i + 1];
      const c = z[(j + 1) * (n + 1) + i + 1], d = z[(j + 1) * (n + 1) + i];
      // Corners a (i, j), b (i+1, j), c (i+1, j+1), d (i, j+1).
      const pts = [];
      const edge = (v0, v1, x0, y0, x1, y1) => {
        if ((v0 > L) !== (v1 > L)) {
          const t = (L - v0) / (v1 - v0);
          pts.push([X(x0 + t * (x1 - x0)), Y(y0 + t * (y1 - y0))]);
        }
      };
      edge(a, b, i, j, i + 1, j);
      edge(b, c, i + 1, j, i + 1, j + 1);
      edge(c, d, i + 1, j + 1, i, j + 1);
      edge(d, a, i, j + 1, i, j);
      if (pts.length === 2) segs.push(pts);
      else if (pts.length === 4) segs.push(pts.slice(0, 2), pts.slice(2));
    }
  }
  return segs;
}

/** SVG path data for a list of two-point segments. */
function segPath(segs) {
  return segs.map(([[x0, y0], [x1, y1]]) =>
    `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`)
    .join("");
}

/** SVG points attribute for a list of [x, y]. */
function ptsAttr(pts) {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}
