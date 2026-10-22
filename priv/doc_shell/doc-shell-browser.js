var O = /[\u0000-\u0020\u007f-\u009f]/g, P = /^([a-z][a-z\d+.-]*):/i, _ = /&#(?:x([\da-f]+)|(\d+));?/gi;
function D() {
  return typeof window > "u" ? "http://localhost/" : window.location.href;
}
function U(e) {
  let r = e;
  for (let n = 0; n < 2; n += 1) try {
    const a = decodeURIComponent(r);
    if (a === r) break;
    r = a;
  } catch {
    break;
  }
  return r.replace(_, (n, a, o) => {
    const t = Number.parseInt(a ?? o ?? "0", a ? 16 : 10);
    return t <= 1114111 ? String.fromCodePoint(t) : "";
  }).replace(/&colon;/gi, ":").replace(O, "");
}
function j(e) {
  return e.startsWith("//") || e.startsWith("\\\\");
}
function I(e, r = D()) {
  const n = e?.trim();
  if (!n || n.includes("\\")) return;
  const a = U(n);
  if (j(a)) return;
  const o = a.match(P);
  if (!o) return {
    href: n,
    external: !1,
    navigable: !0
  };
  const t = o[1]?.toLowerCase();
  if (t === "mailto") return {
    href: n,
    external: !1,
    navigable: !1
  };
  if (!(t !== "http" && t !== "https"))
    try {
      const i = new URL(n), l = i.origin !== new URL(r).origin;
      return {
        href: i.href,
        external: l,
        navigable: !l
      };
    } catch {
      return;
    }
}
var T = (e) => e.normalize("NFC").toLocaleLowerCase("und"), $ = (e, r) => {
  const n = Array.isArray(e.audience) ? e.audience : [e.audience];
  return (Array.isArray(r) ? r : [r]).every((a) => n.includes(a));
}, B = (e, r) => Object.entries(r).every(([n, a]) => a === void 0 ? !0 : n === "tag" ? e.tags.includes(String(a)) : n === "audience" ? $(e, a) : e[n] === a), w = (e, r, n) => e && T(e).includes(r) ? n : 0, z = (e, r, n = {}, a = 20) => {
  const o = T(r);
  return e.filter((t) => B(t, n)).map((t) => ({
    record: t,
    score: o === "" ? 1 : w(t.title, o, 4) + w(t.section, o, 2) + w(t.text, o, 1)
  })).filter(({ score: t }) => t > 0).sort((t, i) => i.score - t.score || t.record.route.localeCompare(i.record.route) || t.record.id.localeCompare(i.record.id)).slice(0, a).map(({ record: t }) => t);
}, H = (e) => typeof e == "object" && e !== null && typeof e.search == "function", W = (e, r = window.location.origin) => {
  if (typeof e != "object" || e === null || e.schema_version !== "doc-shell-search-query/v1" || e.algorithm !== "pagefind/v1") return;
  const n = e.path;
  if (!(typeof n != "string" || !n.startsWith("/") || n.startsWith("//"))) {
    try {
      const a = new URL(n, r);
      if (a.origin !== r || a.pathname !== n || a.search !== "" || a.hash !== "" || n.split("/").some((o) => o === "." || o === "..")) return;
    } catch {
      return;
    }
    return e;
  }
}, F = async (e) => import(
  /* @vite-ignore */
  e
), K = (e, r = F, n = window.location.origin) => {
  const a = W(e, n);
  if (a)
    return J(async () => {
      const o = await r(a.path);
      if (!H(o)) throw new Error("Invalid Pagefind browser module");
      return o;
    });
}, J = (e) => {
  let r;
  return async (n, a = {}) => {
    r ??= e();
    const o = await (await r).search(n, { filters: Object.fromEntries(Object.entries(a).filter((t) => t[1] !== void 0)) });
    return (await Promise.all(o.results.map((t) => t.data()))).map((t) => ({
      ...t,
      id: t.id ?? t.meta.record_id,
      url: t.meta.route ?? t.url
    }));
  };
}, A = (e, r) => [...e.querySelectorAll(r)], V = (e) => {
  const r = new AbortController(), n = () => A(e, "[data-doc-nav-toggle]").forEach((a) => {
    const o = a.getAttribute("aria-controls"), t = o ? e.querySelector(`#${CSS.escape(o)}`) : null;
    t && !t.dataset.docNavState && (t.dataset.docNavState = "closed");
  });
  return e.addEventListener("click", (a) => {
    const o = a.target.closest("[data-doc-nav-toggle]");
    if (!o) return;
    const t = o.getAttribute("aria-controls"), i = t ? e.querySelector(`#${CSS.escape(t)}`) : void 0;
    if (!i) return;
    const l = o.getAttribute("aria-expanded") !== "true";
    o.setAttribute("aria-expanded", String(l)), i.dataset.docNavState = l ? "open" : "closed";
  }, { signal: r.signal }), n(), {
    refresh: n,
    destroy: () => r.abort()
  };
}, Y = (e) => {
  const r = e.dataset.docSearchRecords;
  if (!r) return [];
  try {
    const n = Uint8Array.from(atob(r.replace(/-/g, "+").replace(/_/g, "/")), (o) => o.charCodeAt(0)), a = JSON.parse(new TextDecoder().decode(n));
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}, X = (e) => {
  const r = e.dataset.docSearchContract;
  if (r)
    try {
      const n = Uint8Array.from(atob(r.replace(/-/g, "+").replace(/_/g, "/")), (a) => a.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(n));
    } catch {
      return;
    }
}, G = (e) => {
  const r = e.id ?? e.meta.record_id ?? e.url;
  return {
    id: r,
    page_id: e.meta.page_id ?? r,
    route: e.url,
    title: e.meta.title ?? e.meta.record_id ?? e.url,
    section: e.meta.section,
    text: e.excerpt,
    locale: e.meta.locale ?? "",
    audience: e.meta.audience,
    kind: e.meta.kind ?? "",
    collection: e.meta.collection ?? "",
    version: e.meta.version ?? "",
    tags: [],
    status: e.meta.status
  };
}, Q = (e) => {
  const r = document.createElement("p");
  r.className = "doc-search-excerpt";
  let n = r, a = 320;
  for (const o of e.slice(0, 2048).split(/(<\/?mark>)/i)) if (o.toLowerCase() === "<mark>")
    n = document.createElement("mark"), r.append(n);
  else if (o.toLowerCase() === "</mark>") n = r;
  else {
    const t = Array.from(o), i = t.slice(0, a);
    if (n.append(document.createTextNode(i.join(""))), a -= i.length, t.length > i.length && n.append("…"), a === 0) break;
  }
  return r;
}, Z = (e, r) => {
  const n = new AbortController();
  let a, o = 0, t = [], i = 0, l;
  const s = e.querySelector("[data-doc-search-dialog]"), m = s?.dataset.docSearchPresentation === "inline", g = s?.querySelector("[data-doc-search-input]"), d = s?.querySelector("[data-doc-search-results]"), y = s?.querySelector("[data-doc-search-status]"), R = s ? Y(s) : [], C = s ? K(X(s), r) : void 0, k = () => Object.fromEntries(A(s ?? e, "[data-doc-search-filter]").map((c) => [c.dataset.docSearchFilter, c.value]).filter((c) => !!(c[0] && c[1]))), p = () => {
    !g || !d || (o = Math.min(o, Math.max(0, t.length - 1)), d.replaceChildren(...t.map((c, u) => {
      const f = document.createElement("li");
      f.id = `doc-search-result-${u}`, f.setAttribute("role", "option"), f.setAttribute("aria-selected", String(u === o));
      const b = I(c.route), h = document.createElement(b ? "a" : "span");
      b && h instanceof HTMLAnchorElement && (h.href = b.href, b.external && (h.target = "_blank", h.rel = "noopener noreferrer"));
      const x = [
        c.section,
        c.collection,
        c.version
      ].filter(Boolean).join(" · ");
      if (h.append(document.createTextNode(c.title)), x) {
        const L = document.createElement("small");
        L.textContent = x, h.append(L);
      }
      return typeof c.text == "string" && c.text.trim() && h.append(Q(c.text)), f.append(h), f;
    })), g.setAttribute("aria-activedescendant", t[o] ? `doc-search-result-${o}` : ""), y && (y.textContent = d.dataset.docSearchState === "error" ? "Search unavailable. Try again." : d.dataset.docSearchState === "ready" ? t.length === 0 ? "No results" : `${t.length} ${t.length === 1 ? "result" : "results"}` : ""));
  }, S = () => {
    if (!g || !d) return;
    const c = g.value.trim(), u = ++i;
    if (c.length < 2) {
      t = [], d.dataset.docSearchState = "idle", d.removeAttribute("aria-busy"), p();
      return;
    }
    if (!C) {
      t = z(R, c, k(), 20), d.dataset.docSearchState = "ready", d.removeAttribute("aria-busy"), p();
      return;
    }
    d.dataset.docSearchState = "loading", d.setAttribute("aria-busy", "true"), y && (y.textContent = "Searching…"), C(c, k()).then((f) => {
      i !== u || n.signal.aborted || (t = f.slice(0, 20).map(G), d.dataset.docSearchState = "ready", d.removeAttribute("aria-busy"), p());
    }).catch(() => {
      i !== u || n.signal.aborted || (t = [], d.dataset.docSearchState = "error", d.removeAttribute("aria-busy"), p());
    });
  }, E = (c) => {
    !s || !g || (a = c ?? a, m && !s.hasAttribute("open") && (l = {
      left: window.scrollX,
      top: window.scrollY
    }), !m && typeof s.showModal == "function" ? s.open || s.showModal() : s.setAttribute("open", ""), g.focus());
  }, v = () => {
    s && (!m && typeof s.close == "function" ? s.close() : s.removeAttribute("open"), a?.focus({ preventScroll: !!l }), l && (window.scrollTo(l), l = void 0));
  };
  return e.addEventListener("click", (c) => {
    const u = c.target, f = u.closest("[data-doc-search-open]");
    f && E(f), u.closest("[data-doc-search-close]") && v(), u.closest("[data-doc-search-results] a") && v();
  }, { signal: n.signal }), e.addEventListener("input", (c) => {
    c.target.matches("[data-doc-search-input], [data-doc-search-filter]") && S();
  }, { signal: n.signal }), e.addEventListener("change", (c) => {
    c.target.matches("[data-doc-search-filter]") && S();
  }, { signal: n.signal }), e.addEventListener("keydown", (c) => {
    if ((c.metaKey || c.ctrlKey) && c.key.toLowerCase() === "k") {
      c.preventDefault(), E(e.querySelector("[data-doc-search-open]") ?? void 0);
      return;
    }
    if (s?.hasAttribute("open")) {
      if (c.key === "Escape") {
        c.preventDefault(), v();
        return;
      }
      if (!(m && c.target !== g))
        if (c.key === "ArrowDown" || c.key === "ArrowUp") {
          c.preventDefault();
          const u = c.key === "ArrowDown" ? 1 : -1;
          o = Math.max(0, Math.min(t.length - 1, o + u)), p();
        } else c.key === "Enter" && t[o] && (c.preventDefault(), d?.children[o]?.querySelector("a")?.click());
    }
  }, { signal: n.signal }), {
    refresh: S,
    destroy: () => n.abort()
  };
}, ee = (e) => {
  const r = new AbortController();
  return e.addEventListener("click", async (n) => {
    const a = n.target.closest("[data-doc-copy]");
    if (!a) return;
    const o = a.dataset.docCopy, t = o ? e.querySelector(`#${CSS.escape(o)}`) : a.closest("[data-doc-code]")?.querySelector("code");
    t && (await navigator.clipboard?.writeText(t.textContent ?? ""), a.dataset.docCopyState = "copied", a.setAttribute("aria-label", "Copied"));
  }, { signal: r.signal }), {
    refresh: () => {
    },
    destroy: () => r.abort()
  };
}, te = (e) => {
  const r = new AbortController(), n = (a) => {
    const o = a.closest('[role="tablist"]');
    if (o)
      for (const t of o.querySelectorAll('[role="tab"]')) {
        const i = t === a;
        t.setAttribute("aria-selected", String(i)), t.tabIndex = i ? 0 : -1;
        const l = t.getAttribute("aria-controls");
        if (l) {
          const s = e.querySelector(`#${CSS.escape(l)}`);
          s && (s.hidden = !i);
        }
      }
  };
  return e.addEventListener("click", (a) => {
    const o = a.target.closest('[role="tab"]');
    o && n(o);
  }, { signal: r.signal }), e.addEventListener("keydown", (a) => {
    const o = a.target.closest('[role="tab"]');
    if (!o) return;
    const t = [...o.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]:not([disabled])') ?? []], i = t.indexOf(o);
    let l = i;
    if (a.key === "ArrowRight" || a.key === "ArrowDown") l = (i + 1) % t.length;
    else if (a.key === "ArrowLeft" || a.key === "ArrowUp") l = (i - 1 + t.length) % t.length;
    else if (a.key === "Home") l = 0;
    else if (a.key === "End") l = t.length - 1;
    else return;
    a.preventDefault();
    const s = t[l];
    s && (n(s), s.focus());
  }, { signal: r.signal }), {
    refresh: () => A(e, '[role="tablist"]').forEach((a) => {
      const o = a.querySelector('[role="tab"][aria-selected="true"]') ?? a.querySelector('[role="tab"]');
      o && n(o);
    }),
    destroy: () => r.abort()
  };
}, N = "phoenix-assets:doc-shell:theme", M = /* @__PURE__ */ new Set([
  "system",
  "light",
  "dark",
  "contrast"
]), re = (e = localStorage) => {
  const r = e.getItem(N);
  return r && M.has(r) ? r : "system";
}, q = (e, r) => {
  e.dataset.paTheme = r === "system" ? "" : r, e.dataset.docTheme = r;
}, ae = (e, r = localStorage) => {
  const n = new AbortController(), a = () => q(e, re(r));
  return e.addEventListener("click", (o) => {
    const t = o.target.closest("[data-doc-theme-value]")?.dataset.docThemeValue;
    !t || !M.has(t) || (r.setItem(N, t), q(e, t));
  }, { signal: n.signal }), a(), {
    refresh: a,
    destroy: () => n.abort()
  };
}, ne = (e) => {
  const r = [
    ae(e),
    V(e),
    Z(e),
    ee(e),
    te(e)
  ];
  return {
    refresh: () => r.forEach((n) => n.refresh()),
    destroy: () => r.splice(0).forEach((n) => n.destroy())
  };
}, oe = (e = document.documentElement) => {
  let r;
  const n = () => {
    r ??= ne(e);
  };
  return document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", n, { once: !0 }) : n(), {
    refresh: () => r?.refresh(),
    destroy: () => {
      document.removeEventListener("DOMContentLoaded", n), r?.destroy(), r = void 0;
    }
  };
};
oe();
