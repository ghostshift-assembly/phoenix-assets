var N = /[\u0000-\u0020\u007f-\u009f]/g, O = /^([a-z][a-z\d+.-]*):/i, P = /&#(?:x([\da-f]+)|(\d+));?/gi;
function _() {
  return typeof window > "u" ? "http://localhost/" : window.location.href;
}
function D(e) {
  let r = e;
  for (let n = 0; n < 2; n += 1) try {
    const a = decodeURIComponent(r);
    if (a === r) break;
    r = a;
  } catch {
    break;
  }
  return r.replace(P, (n, a, o) => {
    const t = Number.parseInt(a ?? o ?? "0", a ? 16 : 10);
    return t <= 1114111 ? String.fromCodePoint(t) : "";
  }).replace(/&colon;/gi, ":").replace(N, "");
}
function U(e) {
  return e.startsWith("//") || e.startsWith("\\\\");
}
function I(e, r = _()) {
  const n = e?.trim();
  if (!n || n.includes("\\")) return;
  const a = D(n);
  if (U(a)) return;
  const o = a.match(O);
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
      const i = new URL(n), s = i.origin !== new URL(r).origin;
      return {
        href: i.href,
        external: s,
        navigable: !s
      };
    } catch {
      return;
    }
}
var q = (e) => e.normalize("NFC").toLocaleLowerCase("und"), $ = (e, r) => {
  const n = Array.isArray(e.audience) ? e.audience : [e.audience];
  return (Array.isArray(r) ? r : [r]).every((a) => n.includes(a));
}, j = (e, r) => Object.entries(r).every(([n, a]) => a === void 0 ? !0 : n === "tag" ? e.tags.includes(String(a)) : n === "audience" ? $(e, a) : e[n] === a), v = (e, r, n) => e && q(e).includes(r) ? n : 0, B = (e, r, n = {}, a = 20) => {
  const o = q(r);
  return e.filter((t) => j(t, n)).map((t) => ({
    record: t,
    score: o === "" ? 1 : v(t.title, o, 4) + v(t.section, o, 2) + v(t.text, o, 1)
  })).filter(({ score: t }) => t > 0).sort((t, i) => i.score - t.score || t.record.route.localeCompare(i.record.route) || t.record.id.localeCompare(i.record.id)).slice(0, a).map(({ record: t }) => t);
}, z = (e) => typeof e == "object" && e !== null && typeof e.search == "function", H = (e, r = window.location.origin) => {
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
}, W = async (e) => import(
  /* @vite-ignore */
  e
), F = (e, r = W, n = window.location.origin) => {
  const a = H(e, n);
  if (a)
    return K(async () => {
      const o = await r(a.path);
      if (!z(o)) throw new Error("Invalid Pagefind browser module");
      return o;
    });
}, K = (e) => {
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
}, w = (e, r) => [...e.querySelectorAll(r)], J = (e) => {
  const r = new AbortController(), n = () => w(e, "[data-doc-nav-toggle]").forEach((a) => {
    const o = a.getAttribute("aria-controls"), t = o ? e.querySelector(`#${CSS.escape(o)}`) : null;
    t && !t.dataset.docNavState && (t.dataset.docNavState = "closed");
  });
  return e.addEventListener("click", (a) => {
    const o = a.target.closest("[data-doc-nav-toggle]");
    if (!o) return;
    const t = o.getAttribute("aria-controls"), i = t ? e.querySelector(`#${CSS.escape(t)}`) : void 0;
    if (!i) return;
    const s = o.getAttribute("aria-expanded") !== "true";
    o.setAttribute("aria-expanded", String(s)), i.dataset.docNavState = s ? "open" : "closed";
  }, { signal: r.signal }), n(), {
    refresh: n,
    destroy: () => r.abort()
  };
}, V = (e) => {
  const r = e.dataset.docSearchRecords;
  if (!r) return [];
  try {
    const n = Uint8Array.from(atob(r.replace(/-/g, "+").replace(/_/g, "/")), (o) => o.charCodeAt(0)), a = JSON.parse(new TextDecoder().decode(n));
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}, Y = (e) => {
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
}, Q = (e, r) => {
  const n = new AbortController();
  let a, o = 0, t = [], i = 0;
  const s = e.querySelector("[data-doc-search-dialog]"), u = s?.dataset.docSearchPresentation === "inline", h = s?.querySelector("[data-doc-search-input]"), l = s?.querySelector("[data-doc-search-results]"), p = s?.querySelector("[data-doc-search-status]"), R = s ? V(s) : [], A = s ? F(Y(s), r) : void 0, C = () => Object.fromEntries(w(s ?? e, "[data-doc-search-filter]").map((c) => [c.dataset.docSearchFilter, c.value]).filter((c) => !!(c[0] && c[1]))), m = () => {
    !h || !l || (o = Math.min(o, Math.max(0, t.length - 1)), l.replaceChildren(...t.map((c, d) => {
      const f = document.createElement("li");
      f.id = `doc-search-result-${d}`, f.setAttribute("role", "option"), f.setAttribute("aria-selected", String(d === o));
      const y = I(c.route), g = document.createElement(y ? "a" : "span");
      y && g instanceof HTMLAnchorElement && (g.href = y.href, y.external && (g.target = "_blank", g.rel = "noopener noreferrer"));
      const k = [
        c.section,
        c.collection,
        c.version
      ].filter(Boolean).join(" · ");
      if (g.append(document.createTextNode(c.title)), k) {
        const x = document.createElement("small");
        x.textContent = k, g.append(x);
      }
      return f.append(g), f;
    })), h.setAttribute("aria-activedescendant", t[o] ? `doc-search-result-${o}` : ""), p && (p.textContent = l.dataset.docSearchState === "error" ? "Search unavailable. Try again." : l.dataset.docSearchState === "ready" ? t.length === 0 ? "No results" : `${t.length} ${t.length === 1 ? "result" : "results"}` : ""));
  }, b = () => {
    if (!h || !l) return;
    const c = h.value.trim(), d = ++i;
    if (c.length < 2) {
      t = [], l.dataset.docSearchState = "idle", l.removeAttribute("aria-busy"), m();
      return;
    }
    if (!A) {
      t = B(R, c, C(), 20), l.dataset.docSearchState = "ready", l.removeAttribute("aria-busy"), m();
      return;
    }
    l.dataset.docSearchState = "loading", l.setAttribute("aria-busy", "true"), p && (p.textContent = "Searching…"), A(c, C()).then((f) => {
      i !== d || n.signal.aborted || (t = f.slice(0, 20).map(G), l.dataset.docSearchState = "ready", l.removeAttribute("aria-busy"), m());
    }).catch(() => {
      i !== d || n.signal.aborted || (t = [], l.dataset.docSearchState = "error", l.removeAttribute("aria-busy"), m());
    });
  }, E = (c) => {
    !s || !h || (a = c ?? a, !u && typeof s.showModal == "function" ? s.open || s.showModal() : s.setAttribute("open", ""), h.focus());
  }, S = () => {
    s && (!u && typeof s.close == "function" ? s.close() : s.removeAttribute("open"), a?.focus());
  };
  return e.addEventListener("click", (c) => {
    const d = c.target, f = d.closest("[data-doc-search-open]");
    f && E(f), d.closest("[data-doc-search-close]") && S(), d.closest("[data-doc-search-results] a") && S();
  }, { signal: n.signal }), e.addEventListener("input", (c) => {
    c.target.matches("[data-doc-search-input], [data-doc-search-filter]") && b();
  }, { signal: n.signal }), e.addEventListener("change", (c) => {
    c.target.matches("[data-doc-search-filter]") && b();
  }, { signal: n.signal }), e.addEventListener("keydown", (c) => {
    if ((c.metaKey || c.ctrlKey) && c.key.toLowerCase() === "k") {
      c.preventDefault(), E(e.querySelector("[data-doc-search-open]") ?? void 0);
      return;
    }
    if (s?.hasAttribute("open")) {
      if (c.key === "Escape") {
        c.preventDefault(), S();
        return;
      }
      if (!(u && c.target !== h))
        if (c.key === "ArrowDown" || c.key === "ArrowUp") {
          c.preventDefault();
          const d = c.key === "ArrowDown" ? 1 : -1;
          o = Math.max(0, Math.min(t.length - 1, o + d)), m();
        } else c.key === "Enter" && t[o] && (c.preventDefault(), l?.children[o]?.querySelector("a")?.click());
    }
  }, { signal: n.signal }), {
    refresh: b,
    destroy: () => n.abort()
  };
}, X = (e) => {
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
}, Z = (e) => {
  const r = new AbortController(), n = (a) => {
    const o = a.closest('[role="tablist"]');
    if (o)
      for (const t of o.querySelectorAll('[role="tab"]')) {
        const i = t === a;
        t.setAttribute("aria-selected", String(i)), t.tabIndex = i ? 0 : -1;
        const s = t.getAttribute("aria-controls");
        if (s) {
          const u = e.querySelector(`#${CSS.escape(s)}`);
          u && (u.hidden = !i);
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
    let s = i;
    if (a.key === "ArrowRight" || a.key === "ArrowDown") s = (i + 1) % t.length;
    else if (a.key === "ArrowLeft" || a.key === "ArrowUp") s = (i - 1 + t.length) % t.length;
    else if (a.key === "Home") s = 0;
    else if (a.key === "End") s = t.length - 1;
    else return;
    a.preventDefault();
    const u = t[s];
    u && (n(u), u.focus());
  }, { signal: r.signal }), {
    refresh: () => w(e, '[role="tablist"]').forEach((a) => {
      const o = a.querySelector('[role="tab"][aria-selected="true"]') ?? a.querySelector('[role="tab"]');
      o && n(o);
    }),
    destroy: () => r.abort()
  };
}, T = "phoenix-assets:doc-shell:theme", M = /* @__PURE__ */ new Set([
  "system",
  "light",
  "dark",
  "contrast"
]), ee = (e = localStorage) => {
  const r = e.getItem(T);
  return r && M.has(r) ? r : "system";
}, L = (e, r) => {
  e.dataset.paTheme = r === "system" ? "" : r, e.dataset.docTheme = r;
}, te = (e, r = localStorage) => {
  const n = new AbortController(), a = () => L(e, ee(r));
  return e.addEventListener("click", (o) => {
    const t = o.target.closest("[data-doc-theme-value]")?.dataset.docThemeValue;
    !t || !M.has(t) || (r.setItem(T, t), L(e, t));
  }, { signal: n.signal }), a(), {
    refresh: a,
    destroy: () => n.abort()
  };
}, re = (e) => {
  const r = [
    te(e),
    J(e),
    Q(e),
    X(e),
    Z(e)
  ];
  return {
    refresh: () => r.forEach((n) => n.refresh()),
    destroy: () => r.splice(0).forEach((n) => n.destroy())
  };
}, ae = (e = document.documentElement) => {
  let r;
  const n = () => {
    r ??= re(e);
  };
  return document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", n, { once: !0 }) : n(), {
    refresh: () => r?.refresh(),
    destroy: () => {
      document.removeEventListener("DOMContentLoaded", n), r?.destroy(), r = void 0;
    }
  };
};
ae();
