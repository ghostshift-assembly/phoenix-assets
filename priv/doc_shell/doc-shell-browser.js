var D = /[\u0000-\u0020\u007f-\u009f]/g, U = /^([a-z][a-z\d+.-]*):/i, j = /&#(?:x([\da-f]+)|(\d+));?/gi;
function I() {
  return typeof window > "u" ? "http://localhost/" : window.location.href;
}
function $(e) {
  let r = e;
  for (let o = 0; o < 2; o += 1) try {
    const a = decodeURIComponent(r);
    if (a === r) break;
    r = a;
  } catch {
    break;
  }
  return r.replace(j, (o, a, n) => {
    const t = Number.parseInt(a ?? n ?? "0", a ? 16 : 10);
    return t <= 1114111 ? String.fromCodePoint(t) : "";
  }).replace(/&colon;/gi, ":").replace(D, "");
}
function B(e) {
  return e.startsWith("//") || e.startsWith("\\\\");
}
function z(e, r = I()) {
  const o = e?.trim();
  if (!o || o.includes("\\")) return;
  const a = $(o);
  if (B(a)) return;
  const n = a.match(U);
  if (!n) return {
    href: o,
    external: !1,
    navigable: !0
  };
  const t = n[1]?.toLowerCase();
  if (t === "mailto") return {
    href: o,
    external: !1,
    navigable: !1
  };
  if (!(t !== "http" && t !== "https"))
    try {
      const i = new URL(o), l = i.origin !== new URL(r).origin;
      return {
        href: i.href,
        external: l,
        navigable: !l
      };
    } catch {
      return;
    }
}
var O = (e) => e.normalize("NFC").toLocaleLowerCase("und"), H = (e, r) => {
  const o = Array.isArray(e.audience) ? e.audience : [e.audience];
  return (Array.isArray(r) ? r : [r]).every((a) => o.includes(a));
}, W = (e, r) => Object.entries(r).every(([o, a]) => a === void 0 ? !0 : o === "tag" ? e.tags.includes(String(a)) : o === "audience" ? H(e, a) : e[o] === a), A = (e, r, o) => e && O(e).includes(r) ? o : 0, F = (e, r, o = {}, a = 20) => {
  const n = O(r);
  return e.filter((t) => W(t, o)).map((t) => ({
    record: t,
    score: n === "" ? 1 : A(t.title, n, 4) + A(t.section, n, 2) + A(t.text, n, 1)
  })).filter(({ score: t }) => t > 0).sort((t, i) => i.score - t.score || t.record.route.localeCompare(i.record.route) || t.record.id.localeCompare(i.record.id)).slice(0, a).map(({ record: t }) => t);
}, K = (e) => typeof e == "object" && e !== null && typeof e.search == "function", J = (e, r = window.location.origin) => {
  if (typeof e != "object" || e === null || e.schema_version !== "doc-shell-search-query/v1" || e.algorithm !== "pagefind/v1") return;
  const o = e.path;
  if (!(typeof o != "string" || !o.startsWith("/") || o.startsWith("//"))) {
    try {
      const a = new URL(o, r);
      if (a.origin !== r || a.pathname !== o || a.search !== "" || a.hash !== "" || o.split("/").some((n) => n === "." || n === "..")) return;
    } catch {
      return;
    }
    return e;
  }
}, V = async (e) => import(
  /* @vite-ignore */
  e
), T = (e, r = V, o = window.location.origin) => {
  const a = J(e, o);
  if (a)
    return Y(async () => {
      const n = await r(a.path);
      if (!K(n)) throw new Error("Invalid Pagefind browser module");
      return n;
    });
}, Y = (e) => {
  let r;
  return async (o, a = {}) => {
    r ??= e();
    const n = await (await r).search(o, { filters: Object.fromEntries(Object.entries(a).filter((t) => t[1] !== void 0)) });
    return (await Promise.all(n.results.map((t) => t.data()))).map((t) => ({
      ...t,
      id: t.id ?? t.meta.record_id,
      url: t.meta.route ?? t.url
    }));
  };
}, C = (e, r) => [...e.querySelectorAll(r)], X = (e) => {
  const r = new AbortController(), o = () => C(e, "[data-doc-nav-toggle]").forEach((a) => {
    const n = a.getAttribute("aria-controls"), t = n ? e.querySelector(`#${CSS.escape(n)}`) : null;
    t && !t.dataset.docNavState && (t.dataset.docNavState = "closed");
  });
  return e.addEventListener("click", (a) => {
    const n = a.target.closest("[data-doc-nav-toggle]");
    if (!n) return;
    const t = n.getAttribute("aria-controls"), i = t ? e.querySelector(`#${CSS.escape(t)}`) : void 0;
    if (!i) return;
    const l = n.getAttribute("aria-expanded") !== "true";
    n.setAttribute("aria-expanded", String(l)), i.dataset.docNavState = l ? "open" : "closed";
  }, { signal: r.signal }), o(), {
    refresh: o,
    destroy: () => r.abort()
  };
}, N = (e) => {
  const r = e.dataset.docSearchRecords;
  if (!r) return [];
  try {
    const o = Uint8Array.from(atob(r.replace(/-/g, "+").replace(/_/g, "/")), (n) => n.charCodeAt(0)), a = JSON.parse(new TextDecoder().decode(o));
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}, M = (e) => {
  const r = e.dataset.docSearchContract;
  if (r)
    try {
      const o = Uint8Array.from(atob(r.replace(/-/g, "+").replace(/_/g, "/")), (a) => a.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(o));
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
  let o = r, a = 319;
  for (const n of e.slice(0, 2048).split(/(<\/?mark>)/i)) if (n.toLowerCase() === "<mark>")
    o = document.createElement("mark"), r.append(o);
  else if (n.toLowerCase() === "</mark>") o = r;
  else {
    const t = Array.from(n), i = t.slice(0, a);
    if (o.append(document.createTextNode(i.join(""))), a -= i.length, t.length > i.length && o.append("…"), a === 0) break;
  }
  return r;
}, Z = (e, r) => {
  const o = new AbortController();
  let a, n = 0, t = [], i = 0, l, s = e.querySelector("[data-doc-search-dialog]"), g = s?.dataset.docSearchPresentation === "inline", h = s?.querySelector("[data-doc-search-input]"), d = s?.querySelector("[data-doc-search-results]"), m = s?.querySelector("[data-doc-search-status]"), k = s ? N(s) : [], S = s ? T(M(s), r) : void 0;
  const E = () => Object.fromEntries(C(s ?? e, "[data-doc-search-filter]").map((c) => [c.dataset.docSearchFilter, c.value]).filter((c) => !!(c[0] && c[1]))), y = () => {
    !h || !d || (n = Math.min(n, Math.max(0, t.length - 1)), d.replaceChildren(...t.map((c, u) => {
      const f = document.createElement("li");
      f.id = `doc-search-result-${u}`, f.setAttribute("role", "option"), f.setAttribute("aria-selected", String(u === n));
      const b = z(c.route), p = document.createElement(b ? "a" : "span");
      b && p instanceof HTMLAnchorElement && (p.href = b.href, b.external && (p.target = "_blank", p.rel = "noopener noreferrer"));
      const L = [
        c.section,
        c.collection,
        c.version
      ].filter(Boolean).join(" · ");
      if (p.append(document.createTextNode(c.title)), L) {
        const q = document.createElement("small");
        q.textContent = L, p.append(q);
      }
      return typeof c.text == "string" && c.text.trim() && p.append(Q(c.text)), f.append(p), f;
    })), h.setAttribute("aria-activedescendant", t[n] ? `doc-search-result-${n}` : ""), m && (m.textContent = d.dataset.docSearchState === "error" ? "Search unavailable. Try again." : d.dataset.docSearchState === "ready" ? t.length === 0 ? "No results" : `${t.length} ${t.length === 1 ? "result" : "results"}` : ""));
  }, v = () => {
    if (!h || !d) return;
    const c = h.value.trim(), u = ++i;
    if (c.length < 2) {
      t = [], d.dataset.docSearchState = "idle", d.removeAttribute("aria-busy"), y();
      return;
    }
    if (!S) {
      t = F(k, c, E(), 20), d.dataset.docSearchState = "ready", d.removeAttribute("aria-busy"), y();
      return;
    }
    d.dataset.docSearchState = "loading", d.setAttribute("aria-busy", "true"), m && (m.textContent = "Searching…"), S(c, E()).then((f) => {
      i !== u || o.signal.aborted || (t = f.slice(0, 20).map(G), d.dataset.docSearchState = "ready", d.removeAttribute("aria-busy"), y());
    }).catch(() => {
      i !== u || o.signal.aborted || (t = [], d.dataset.docSearchState = "error", d.removeAttribute("aria-busy"), y());
    });
  }, x = (c) => {
    !s || !h || (a = c ?? a, g && !s.hasAttribute("open") && (l = {
      left: window.scrollX,
      top: window.scrollY
    }), !g && typeof s.showModal == "function" ? s.open || s.showModal() : s.setAttribute("open", ""), h.focus());
  }, w = () => {
    s && (!g && typeof s.close == "function" ? s.close() : s.removeAttribute("open"), a?.focus({ preventScroll: !!l }), l && (window.scrollTo(l), l = void 0));
  };
  return e.addEventListener("click", (c) => {
    const u = c.target, f = u.closest("[data-doc-search-open]");
    f && x(f), u.closest("[data-doc-search-close]") && w(), u.closest("[data-doc-search-results] a") && w();
  }, { signal: o.signal }), e.addEventListener("input", (c) => {
    c.target.matches("[data-doc-search-input], [data-doc-search-filter]") && v();
  }, { signal: o.signal }), e.addEventListener("change", (c) => {
    c.target.matches("[data-doc-search-filter]") && v();
  }, { signal: o.signal }), e.addEventListener("keydown", (c) => {
    if ((c.metaKey || c.ctrlKey) && c.key.toLowerCase() === "k") {
      c.preventDefault(), x(e.querySelector("[data-doc-search-open]") ?? void 0);
      return;
    }
    if (s?.hasAttribute("open")) {
      if (c.key === "Escape") {
        c.preventDefault(), w();
        return;
      }
      if (!(g && c.target !== h))
        if (c.key === "ArrowDown" || c.key === "ArrowUp") {
          c.preventDefault();
          const u = c.key === "ArrowDown" ? 1 : -1;
          n = Math.max(0, Math.min(t.length - 1, n + u)), y();
        } else c.key === "Enter" && t[n] && (c.preventDefault(), d?.children[n]?.querySelector("a")?.click());
    }
  }, { signal: o.signal }), {
    refresh: () => {
      const c = s;
      s = e.querySelector("[data-doc-search-dialog]"), g = s?.dataset.docSearchPresentation === "inline", h = s?.querySelector("[data-doc-search-input]"), d = s?.querySelector("[data-doc-search-results]"), m = s?.querySelector("[data-doc-search-status]"), k = s ? N(s) : [], S = s ? T(M(s), r) : void 0, c !== s && (n = 0, l = void 0, a?.isConnected || (a = void 0)), v();
    },
    destroy: () => o.abort()
  };
}, ee = (e) => {
  const r = new AbortController();
  return e.addEventListener("click", async (o) => {
    const a = o.target.closest("[data-doc-copy]");
    if (!a) return;
    const n = a.dataset.docCopy, t = n ? e.querySelector(`#${CSS.escape(n)}`) : a.closest("[data-doc-code]")?.querySelector("code");
    t && (await navigator.clipboard?.writeText(t.textContent ?? ""), a.dataset.docCopyState = "copied", a.setAttribute("aria-label", "Copied"));
  }, { signal: r.signal }), {
    refresh: () => {
    },
    destroy: () => r.abort()
  };
}, te = (e) => {
  const r = new AbortController(), o = (a) => {
    const n = a.closest('[role="tablist"]');
    if (n)
      for (const t of n.querySelectorAll('[role="tab"]')) {
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
    const n = a.target.closest('[role="tab"]');
    n && o(n);
  }, { signal: r.signal }), e.addEventListener("keydown", (a) => {
    const n = a.target.closest('[role="tab"]');
    if (!n) return;
    const t = [...n.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]:not([disabled])') ?? []], i = t.indexOf(n);
    let l = i;
    if (a.key === "ArrowRight" || a.key === "ArrowDown") l = (i + 1) % t.length;
    else if (a.key === "ArrowLeft" || a.key === "ArrowUp") l = (i - 1 + t.length) % t.length;
    else if (a.key === "Home") l = 0;
    else if (a.key === "End") l = t.length - 1;
    else return;
    a.preventDefault();
    const s = t[l];
    s && (o(s), s.focus());
  }, { signal: r.signal }), {
    refresh: () => C(e, '[role="tablist"]').forEach((a) => {
      const n = a.querySelector('[role="tab"][aria-selected="true"]') ?? a.querySelector('[role="tab"]');
      n && o(n);
    }),
    destroy: () => r.abort()
  };
}, P = "phoenix-assets:doc-shell:theme", _ = /* @__PURE__ */ new Set([
  "system",
  "light",
  "dark",
  "contrast"
]), re = (e = localStorage) => {
  const r = e.getItem(P);
  return r && _.has(r) ? r : "system";
}, R = (e, r) => {
  e.dataset.paTheme = r === "system" ? "" : r, e.dataset.docTheme = r;
}, ae = (e, r = localStorage) => {
  const o = new AbortController(), a = () => R(e, re(r));
  return e.addEventListener("click", (n) => {
    const t = n.target.closest("[data-doc-theme-value]")?.dataset.docThemeValue;
    !t || !_.has(t) || (r.setItem(P, t), R(e, t));
  }, { signal: o.signal }), a(), {
    refresh: a,
    destroy: () => o.abort()
  };
}, oe = (e) => {
  const r = [
    ae(e),
    X(e),
    Z(e),
    ee(e),
    te(e)
  ];
  return {
    refresh: () => r.forEach((o) => o.refresh()),
    destroy: () => r.splice(0).forEach((o) => o.destroy())
  };
}, ne = (e = document.documentElement) => {
  let r;
  const o = () => {
    r ??= oe(e);
  };
  return document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", o, { once: !0 }) : o(), {
    refresh: () => r?.refresh(),
    destroy: () => {
      document.removeEventListener("DOMContentLoaded", o), r?.destroy(), r = void 0;
    }
  };
};
ne();
