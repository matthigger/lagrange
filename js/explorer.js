// One tab's explorer: a problem, the point on its path, the surface view,
// the unrolled path plot, the readout and the controls. Both tabs are
// explorers; Walk has one problem, In practice a list of presets.
//
// Elements are found by id prefix (see index.html); a missing element
// just means the tab lacks that control.

// sin of the angle between ∇f and ∇g below which they count as parallel.
const PARALLEL_TOL = 2e-3;
// Snap to a known solution within this fraction of the path length.
const SNAP = 0.012;

class Explorer {
  /**
   * Args:
   *   pf (string): id prefix of the tab's elements
   *   presets (list): preset ids from PRESETS
   *   show (object): initial { split, flevel, glevels, crit }
   */
  constructor(pf, presets, show) {
    this.pf = pf;
    this.presets = presets.map(id => PRESET[id]);
    this.show = { ...show };
    this.mode = "contour";
    this.anim = null;
    const $ = id => document.getElementById(`${pf}-${id}`);
    this.$ = $;
    const pick = (u, done) => this.pick(u, done);
    this.surf = new SurfView($("surf"), pick);
    this.plot = new PathPlot($("path"), pick);
    this.sweep = $("sweep") ? new SweepChart($("sweep")) : null;
    this.wire();
    this.setPreset(this.presets[0].id);
  }

  wire() {
    const $ = this.$, pf = this.pf;
    for (const b of document.querySelectorAll(`[data-${pf}-view]`)) {
      b.onclick = () => {
        this.mode = b.dataset[`${pf}View`];
        this.render();
      };
    }
    for (const k of ["split", "flevel", "glevels", "crit"]) {
      const c = $(k);
      if (!c) continue;
      c.checked = this.show[k];
      c.onchange = () => { this.show[k] = c.checked; this.render(); };
    }
    $("climb").onclick = () => this.toggleClimb(1);
    $("descend").onclick = () => this.toggleClimb(-1);
    const box = $("presets");
    if (box) {
      for (const p of this.presets) {
        const b = document.createElement("button");
        b.textContent = p.label;
        b.setAttribute("role", "radio");
        b.dataset.preset = p.id;
        b.onclick = () => this.setPreset(p.id);
        box.appendChild(b);
      }
    }
    const sl = $("slider");
    if (sl) {
      sl.oninput = () => {
        this.p = +sl.value;
        this.build(true);
        this.render();
      };
    }
  }

  setPreset(id) {
    this.stop();
    this.preset = PRESET[id];
    const sp = this.preset.slider, sl = this.$("slider");
    this.p = sp ? sp.value : null;
    if (sl) {
      this.$("slider-row").hidden = !sp;
      if (sp) {
        Object.assign(sl, { min: sp.min, max: sp.max, step: sp.step });
        sl.value = sp.value;
        const name = this.$("slider-name");
        name.innerHTML = sp.name;
        name.dataset.tip = sp.tip;
      }
    }
    this.build(false);
    this.u = this.table.wrap(this.preset.startU);
    this.intro();
    this.render();
  }

  /**
   * Build the problem for the current slider value. keep holds the point
   * at the same u (clamped to the new path).
   */
  build(keep) {
    this.stop();
    const prob = this.preset.build(this.p);
    this.prob = prob;
    this.table = new PathTable(prob.path);
    const t = this.table;
    this.sols = prob.sols.map(sol => {
      if (sol.inside) return { ...sol };
      const u = t.nearestTo(sol.x);
      return { ...sol, u, s: t.sAt(u) };
    });
    // One scale for both arrows, from typical gradient sizes on the path.
    const med = vs => vs.sort((a, b) => a - b)[vs.length >> 1];
    const every = t.pts.filter((_, i) => i % 20 === 0);
    const gF = med(every.map(x => norm(prob.gradF(x))));
    const gG = med(every.map(x => norm(prob.gradG(x))));
    this.k = 110 / Math.max(gF, gG, 1e-9);
    this.maxSlope = Math.max(...t.pts.map((x, i) =>
      Math.abs(dot(prob.gradF(x), t.tangent(t.u[i])))));
    if (keep) this.u = t.wrap(this.u);
  }

  /** Fill the tab's intro from the preset's text (In practice only). */
  intro() {
    const box = this.$("intro");
    if (box) {
      const h = this.preset.html;
      box.innerHTML = `
        <div>
          <h2>${h.title}</h2>
          <p class="goal problem"><b>Problem:</b> ${h.problem}</p>
          <p><b>Lagrange:</b> &nabla;<i>f</i> = <i>&lambda;</i>&nabla;<i>${
            this.prob.gSym}</i>, plus the constraint:</p>
          <div class="formula">${h.system}</div>
          <details class="answer"><summary>Worked solution</summary>
            ${h.solution}</details>
        </div>
        <div>
          <h3>Try this</h3>
          <ul class="try">${h.try.map(t => `<li>${t}</li>`).join("")}</ul>
        </div>`;
    }
    const pre = this.$("presets");
    if (pre) {
      for (const b of pre.children) {
        b.setAttribute("aria-checked", b.dataset.preset === this.preset.id);
      }
    }
    const card = this.$("sweep-card");
    if (card) card.hidden = !this.preset.sweep;
  }

  /** Move the point to u, snapping onto a nearby known solution. */
  pick(u, done) {
    this.stop();
    const t = this.table, s = t.sAt(u);
    for (const sol of this.sols) {
      if (sol.s !== undefined && Math.abs(t.gap(s, sol.s)) < SNAP * t.L) {
        u = sol.u;
      }
    }
    this.u = u;
    this.render();
  }

  /** Arrow keys: step the point along the path (dir ±1). */
  nudge(dir) {
    this.stop();
    const t = this.table;
    this.u = t.uAt(t.sAt(this.u) + dir * 0.01 * t.L);
    this.render();
  }

  /**
   * Walk along the path in the direction of ∇f's part along it (sign 1,
   * Climb) or against it (sign -1, Descend), until that part vanishes.
   * Pressing the running button again stops the walk.
   */
  toggleClimb(sign) {
    if (this.anim) {
      const same = this.anim.sign === sign;
      this.stop();
      if (same) return;
    }
    const t = this.table, prob = this.prob;
    const rate = 0.04 * t.L / this.maxSlope, cap = 0.006 * t.L;
    const run = { sign, frames: 0 };
    this.anim = run;
    const slopeAt = u => dot(prob.gradF(t.pos(u)), t.tangent(u));
    const tick = () => {
      if (this.anim !== run) return;
      let m = slopeAt(this.u);
      // Sitting exactly on the wrong kind of critical point: nudge off.
      if (run.frames === 0 && Math.abs(m) < 1e-6 * this.maxSlope) {
        this.u = t.uAt(t.sAt(this.u) + 0.003 * t.L);
        m = slopeAt(this.u);
      }
      const s = t.sAt(this.u);
      const ds = clamp(sign * rate * m, -cap, cap);
      const s2 = t.closed ? s + ds : clamp(s + ds, 0, t.L);
      this.u = t.uAt(s2);
      run.frames++;
      const stuck = !t.closed && (s2 === 0 || s2 === t.L);
      if (Math.abs(slopeAt(this.u)) < 1e-5 * this.maxSlope || stuck
        || run.frames > 2000) {
        // Land exactly on the solution the walk converged to.
        this.pick(this.u, true);
        return;
      }
      this.render();
      requestAnimationFrame(tick);
    };
    this.buttons();
    requestAnimationFrame(tick);
  }

  stop() {
    if (!this.anim) return;
    this.anim = null;
    this.buttons();
  }

  buttons() {
    const a = this.anim;
    this.$("climb").textContent = a && a.sign === 1 ? "■ Stop" : "▲ Climb";
    this.$("descend").textContent = a && a.sign === -1 ? "■ Stop"
      : "▼ Descend";
  }

  render() {
    const st = { prob: this.prob, table: this.table, u: this.u,
      mode: this.mode, show: this.show, k: this.k, sols: this.sols };
    for (const b of document.querySelectorAll(`[data-${this.pf}-view]`)) {
      b.setAttribute("aria-checked", b.dataset[`${this.pf}View`] === this.mode);
    }
    this.surf.render(st);
    this.plot.render(st);
    this.readout();
    const sp = this.preset.slider, val = this.$("slider-val");
    if (sp && val) val.textContent = fmt(this.p);
    if (this.sweep && this.preset.sweep) {
      this.sweep.render(this.preset.sweep, sp, this.p);
      this.$("sweep-title").innerHTML = this.preset.sweep.title;
      this.$("sweep-note").innerHTML = this.preset.sweep.note(this.p);
    }
    const hint = this.$("hint");
    if (hint) {
      hint.innerHTML = this.mode === "3d"
        ? "Drag the point or the path to move along it; drag elsewhere to "
          + "orbit, scroll to zoom. The path is drawn on the floor and lifted "
          + "onto the surface."
        : "Drag anywhere: the point follows along the path. &larr; and "
          + "&rarr; step it. Both arrows share one scale.";
    }
  }

  readout() {
    const prob = this.prob, t = this.table, x = t.pos(this.u);
    const gf = prob.gradF(x), gg = prob.gradG(x), T = t.tangent(this.u);
    const m = dot(gf, T), G = prob.gSym;
    const nf = norm(gf), ng = norm(gg);
    const parallel = nf < 1e-9 || Math.abs(cross(gf, gg)) / (nf * ng)
      < PARALLEL_TOL;
    const lam = dot(gf, gg) / (ng * ng);
    const row = (k, v) =>
      `<div class="row"><span>${k}</span><span class="val">${v}</span></div>`;
    const ratio = i => {
      const a = gf[i], b = gg[i];
      const r = Math.abs(b) < 1e-12 ? (Math.abs(a) < 1e-9 ? "any" : "none")
        : fmt(a / b);
      return row(`row ${i + 1}: <i>&lambda;</i> = ${fmt(a)} &divide; ${
        fmt(b)}`, r);
    };

    let walk;
    if (Math.abs(m) < 1e-3 * this.maxSlope || parallel) {
      walk = "0: no step along the path raises <i>f</i>";
    } else {
      walk = `<i>f</i> rises walking ${m > 0 ? "forward (s grows)"
        : "backward (s shrinks)"}`;
    }

    let verdict;
    if (!parallel) {
      verdict = `<p class="status no">No: the rows want different
        <i>&lambda;</i>, so &nabla;<i>f</i> is not parallel to
        &nabla;<i>${G}</i>.</p>`;
    } else {
      const sol = this.sols.find(sl => sl.u !== undefined
        && Math.abs(t.gap(t.sAt(this.u), sl.s)) < 1e-6 * t.L);
      let what = sol ? `the constrained ${sol.kind}` : "a critical point";
      if (prob.ineq && lam < -1e-9) {
        verdict = `<p class="status warn-st">&nabla;<i>f</i> =
          <i>&lambda;</i>&nabla;<i>h</i> with <i>&lambda;</i> = ${fmt(lam)}
          &lt; 0: not the min. &nabla;<i>f</i> points out of the feasible
          side, so stepping in lowers <i>f</i>.</p>`;
      } else {
        if (prob.ineq) what = "the min on the boundary (λ ≥ 0)";
        verdict = `<p class="status yes">Yes: &nabla;<i>f</i> =
          <i>&lambda;</i>&nabla;<i>${G}</i> with <i>&lambda;</i> = ${
          fmt(lam)}. This is ${what}.</p>`;
      }
    }

    let sols = "";
    if (this.show.crit) {
      sols = `<h3>Solutions</h3>` + this.sols.map(sl => row(
        `${sl.kind} at ${fmtPt(sl.x)}${sl.inside ? " (inside)" : ""}`,
        `<i>f</i> = ${fmt(prob.f(sl.x))}, <i>&lambda;</i> = ${fmt(sl.lam)}`))
        .join("");
    }

    this.$("readout").innerHTML = `
      <h3>At the point</h3>
      ${row(`<b>x</b> = ${fmtPt(x)}`, `<i>f</i>(<b>x</b>) = ${fmt(prob.f(x))}`)}
      <div class="row vecs">
        <span class="fgrad-t">&nabla;<i>f</i> = ${fmtCol(gf)}</span>
        <span class="agrad-t">&nabla;<i>${G}</i> = ${fmtCol(gg)}</span>
      </div>
      <h3>Along the path</h3>
      ${row(`<span class="along-t"><b>u</b> &middot; &nabla;<i>f</i></span>`,
        fmt(m))}
      <p class="muted">${walk}</p>
      <h3>Is &nabla;<i>f</i> = <i>&lambda;</i>&nabla;<i>${G}</i>?</h3>
      ${ratio(0)}${ratio(1)}
      ${verdict}
      ${sols}`;
  }
}
