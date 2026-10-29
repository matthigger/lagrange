// Tabs, hash routing, arrow-key steps and the footer build stamp. Each tab
// is an Explorer with its own state and DOM.

(function () {
  const TABS = {
    walk: new Explorer("wk", ["circle"],
      { split: true, flevel: true, glevels: false, crit: false }),
    examples: new Explorer("ex", PRESETS.map(p => p.id),
      { split: false, flevel: true, glevels: false, crit: true }),
  };
  const HASH = { walk: "#walk", examples: "#examples" };
  let mode = "walk";

  function setMode(m) {
    TABS[mode].stop();
    mode = m;
    history.replaceState(null, "", HASH[m]);
    for (const t of document.querySelectorAll(".tab")) {
      t.setAttribute("aria-selected", t.dataset.mode === m);
    }
    for (const el of document.querySelectorAll("[data-show]")) {
      el.hidden = !el.dataset.show.split(" ").includes(m);
    }
    TABS[m].render();
  }

  for (const t of document.querySelectorAll(".tab")) {
    t.onclick = () => { if (t.dataset.mode !== mode) setMode(t.dataset.mode); };
  }

  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      TABS[mode].nudge(e.key === "ArrowRight" ? 1 : -1);
    }
  });

  // Footer build stamp: the deployed commit (linked) and build time.
  const el = document.getElementById("build");
  const repo = "https://github.com/matthigger/lagrange";
  if (!BUILD) {
    el.textContent = "local copy";
  } else {
    const when = new Date(BUILD.time).toLocaleString("en-US", {
      dateStyle: "medium", timeStyle: "short" });
    el.innerHTML = `build <a href="${repo}/commit/${BUILD.sha}">${
      BUILD.sha.slice(0, 7)}</a>, ${when}`;
  }

  const fromHash = Object.keys(HASH).find(m => HASH[m] === location.hash);
  setMode(fromHash || "walk");
})();
