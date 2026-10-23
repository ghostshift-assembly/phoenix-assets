var W = /[\u0000-\u0020\u007f-\u009f]/g, z = /^([a-z][a-z\d+.-]*):/i, F = /&#(?:x([\da-f]+)|(\d+));?/gi;
function _() {
  return typeof window > "u" ? "http://localhost/" : window.location.href;
}
function I(e) {
  let a = e;
  for (let r = 0; r < 2; r += 1) try {
    const t = decodeURIComponent(a);
    if (t === a) break;
    a = t;
  } catch {
    break;
  }
  return a.replace(F, (r, t, o) => {
    const n = Number.parseInt(t ?? o ?? "0", t ? 16 : 10);
    return n <= 1114111 ? String.fromCodePoint(n) : "";
  }).replace(/&colon;/gi, ":").replace(W, "");
}
function q(e) {
  return e.startsWith("//") || e.startsWith("\\\\");
}
function U(e, a = _()) {
  const r = e?.trim();
  if (!r || r.includes("\\")) return;
  const t = I(r);
  if (q(t)) return;
  const o = t.match(z);
  if (!o) return {
    href: r,
    external: !1,
    navigable: !0
  };
  const n = o[1]?.toLowerCase();
  if (n === "mailto") return {
    href: r,
    external: !1,
    navigable: !1
  };
  if (!(n !== "http" && n !== "https"))
    try {
      const s = new URL(r), l = s.origin !== new URL(a).origin;
      return {
        href: s.href,
        external: l,
        navigable: !l
      };
    } catch {
      return;
    }
}
function K(e, a, r = _()) {
  const t = a.trim();
  if (!t.startsWith("/") || q(t) || t.includes("\\")) throw new Error("Try-it operation paths must be root-relative URLs");
  const o = e.trim();
  if (q(I(o))) throw new Error("Try-it base URLs cannot be scheme-relative");
  const n = new URL(r), s = new URL(o || "/", n);
  if (!["http:", "https:"].includes(s.protocol) || s.username || s.password) throw new Error("Try-it base URLs must use HTTP(S) without embedded credentials");
  const l = s.pathname === "/" ? "" : s.pathname.replace(/\/$/, ""), d = new URL(`${l}${t}`, s.origin);
  return {
    url: d.href,
    origin: d.origin,
    crossOrigin: d.origin !== n.origin
  };
}
function G(e, a) {
  return a.some((r) => {
    try {
      const t = new URL(r);
      return ["http:", "https:"].includes(t.protocol) && t.origin === e;
    } catch {
      return !1;
    }
  });
}
var J = (e, a) => {
  const r = K(a.apiOrigin, e, a.currentHref);
  if (r.crossOrigin && !G(r.origin, a.allowedOrigins ?? [])) throw new Error("request origin is not allowlisted");
  return {
    url: r.url,
    crossOrigin: r.crossOrigin,
    confirmation: r.crossOrigin ? `Send this request to ${r.origin}` : void 0,
    credentials: "same-origin"
  };
}, H = (e) => e.normalize("NFC").toLocaleLowerCase("und"), V = (e, a) => {
  const r = Array.isArray(e.audience) ? e.audience : [e.audience];
  return (Array.isArray(a) ? a : [a]).every((t) => r.includes(t));
}, Y = (e, a) => Object.entries(a).every(([r, t]) => t === void 0 ? !0 : r === "tag" ? e.tags.includes(String(t)) : r === "audience" ? V(e, t) : e[r] === t), T = (e, a, r) => e && H(e).includes(a) ? r : 0, X = (e, a, r = {}, t = 20) => {
  const o = H(a);
  return e.filter((n) => Y(n, r)).map((n) => ({
    record: n,
    score: o === "" ? 1 : T(n.title, o, 4) + T(n.section, o, 2) + T(n.text, o, 1)
  })).filter(({ score: n }) => n > 0).sort((n, s) => s.score - n.score || n.record.route.localeCompare(s.record.route) || n.record.id.localeCompare(s.record.id)).slice(0, t).map(({ record: n }) => n);
}, Q = (e) => typeof e == "object" && e !== null && typeof e.search == "function", Z = (e, a = window.location.origin) => {
  if (typeof e != "object" || e === null || e.schema_version !== "doc-shell-search-query/v1" || e.algorithm !== "pagefind/v1") return;
  const r = e.path;
  if (!(typeof r != "string" || !r.startsWith("/") || r.startsWith("//"))) {
    try {
      const t = new URL(r, a);
      if (t.origin !== a || t.pathname !== r || t.search !== "" || t.hash !== "" || r.split("/").some((o) => o === "." || o === "..")) return;
    } catch {
      return;
    }
    return e;
  }
}, ee = async (e) => import(
  /* @vite-ignore */
  e
), D = (e, a = ee, r = window.location.origin) => {
  const t = Z(e, r);
  if (t)
    return te(async () => {
      const o = await a(t.path);
      if (!Q(o)) throw new Error("Invalid Pagefind browser module");
      return o;
    });
}, te = (e) => {
  let a;
  return async (r, t = {}) => {
    a ??= e();
    const o = await (await a).search(r, { filters: Object.fromEntries(Object.entries(t).filter((n) => n[1] !== void 0)) });
    return (await Promise.all(o.results.map((n) => n.data()))).map((n) => ({
      ...n,
      id: n.id ?? n.meta.record_id,
      url: n.meta.route ?? n.url
    }));
  };
}, L = (e, a) => [...e.querySelectorAll(a)], re = (e) => {
  const a = new AbortController(), r = () => L(e, "[data-doc-nav-toggle]").forEach((t) => {
    const o = t.getAttribute("aria-controls"), n = o ? e.querySelector(`#${CSS.escape(o)}`) : null;
    n && !n.dataset.docNavState && (n.dataset.docNavState = "closed");
  });
  return e.addEventListener("click", (t) => {
    const o = t.target.closest("[data-doc-nav-toggle]");
    if (!o) return;
    const n = o.getAttribute("aria-controls"), s = n ? e.querySelector(`#${CSS.escape(n)}`) : void 0;
    if (!s) return;
    const l = o.getAttribute("aria-expanded") !== "true";
    o.setAttribute("aria-expanded", String(l)), s.dataset.docNavState = l ? "open" : "closed";
  }, { signal: a.signal }), r(), {
    refresh: r,
    destroy: () => a.abort()
  };
}, M = (e) => {
  const a = e.dataset.docSearchRecords;
  if (!a) return [];
  try {
    const r = Uint8Array.from(atob(a.replace(/-/g, "+").replace(/_/g, "/")), (o) => o.charCodeAt(0)), t = JSON.parse(new TextDecoder().decode(r));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}, N = (e) => {
  const a = e.dataset.docSearchContract;
  if (a)
    try {
      const r = Uint8Array.from(atob(a.replace(/-/g, "+").replace(/_/g, "/")), (t) => t.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(r));
    } catch {
      return;
    }
}, ae = (e) => {
  const a = e.id ?? e.meta.record_id ?? e.url;
  return {
    id: a,
    page_id: e.meta.page_id ?? a,
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
}, ne = (e) => {
  const a = document.createElement("p");
  a.className = "doc-search-excerpt";
  let r = a;
  const t = e.slice(0, 2048).split(/(<\/?mark>)/i), o = t.filter((l) => !/^<\/?mark>$/i.test(l)).reduce((l, d) => l + Array.from(d).length, 0), n = e.length > 2048 || o > 320;
  let s = n ? 319 : 320;
  for (const l of t) if (l.toLowerCase() === "<mark>")
    r = document.createElement("mark"), a.append(r);
  else if (l.toLowerCase() === "</mark>") r = a;
  else {
    const d = Array.from(l).slice(0, s);
    if (r.append(document.createTextNode(d.join(""))), s -= d.length, s === 0) break;
  }
  return n && r.append("…"), a;
}, oe = (e, a, r) => {
  const t = new AbortController();
  let o, n = 0, s = [], l = 0, d;
  const A = r ? "[data-doc-search-dialog]" : "[data-doc-search-dialog]:not([data-doc-search-owned])";
  let i = e.querySelector(A), y = i?.dataset.docSearchPresentation === "inline", h = i?.querySelector("[data-doc-search-input]"), u = i?.querySelector("[data-doc-search-results]"), g = i?.querySelector("[data-doc-search-status]"), C = r?.records() ?? (i ? M(i) : []), b = i ? D(r?.contract?.() ?? N(i), a) : void 0;
  const p = () => Object.fromEntries(L(i ?? e, "[data-doc-search-filter]").map((c) => [c.dataset.docSearchFilter, c.value]).filter((c) => !!(c[0] && c[1]))), E = () => {
    if (!h || !u) return;
    n = Math.min(n, Math.max(0, s.length - 1));
    const c = (f) => `${u?.id || "doc-search"}-result-${f}`;
    u.replaceChildren(...s.map((f, m) => {
      const v = document.createElement("li");
      v.id = c(m), v.setAttribute("role", "option"), v.setAttribute("aria-selected", String(m === n));
      const S = U(f.route), w = document.createElement(S ? "a" : "span");
      S && w instanceof HTMLAnchorElement && (w.href = S.href, S.external && (w.target = "_blank", w.rel = "noopener noreferrer"));
      const R = [
        f.section,
        f.collection,
        f.version
      ].filter(Boolean).join(" · ");
      if (w.append(document.createTextNode(f.title)), R) {
        const P = document.createElement("small");
        P.textContent = R, w.append(P);
      }
      return typeof f.text == "string" && f.text.trim() && w.append(ne(f.text)), v.append(w), v;
    })), h.setAttribute("aria-activedescendant", s[n] ? c(n) : ""), g && (g.textContent = u.dataset.docSearchState === "error" ? "Search unavailable. Try again." : u.dataset.docSearchState === "ready" ? s.length === 0 ? "No results" : `${s.length} ${s.length === 1 ? "result" : "results"}` : "");
  }, x = () => {
    if (!h || !u) return;
    const c = h.value.trim(), f = ++l;
    if (c.length < 2) {
      s = [], u.dataset.docSearchState = "idle", u.removeAttribute("aria-busy"), E();
      return;
    }
    if (!b && !r?.search) {
      s = X(C, c, p(), 20), u.dataset.docSearchState = "ready", u.removeAttribute("aria-busy"), E();
      return;
    }
    u.dataset.docSearchState = "loading", u.setAttribute("aria-busy", "true"), g && (g.textContent = "Searching…"), (r?.search ? Promise.resolve().then(() => r.search?.(c, p()) ?? []) : b?.(c, p()).then((m) => m.map(ae)))?.then((m) => {
      l !== f || t.signal.aborted || !u || (s = m.slice(0, 20), u.dataset.docSearchState = "ready", u.removeAttribute("aria-busy"), E());
    }).catch(() => {
      l !== f || t.signal.aborted || !u || (s = [], u.dataset.docSearchState = "error", u.removeAttribute("aria-busy"), E());
    });
  }, O = (c) => {
    !i || !h || (o = c ?? o, y && !i.hasAttribute("open") && (d = {
      left: window.scrollX,
      top: window.scrollY
    }), !y && typeof i.showModal == "function" ? i.open || i.showModal() : i.setAttribute("open", ""), h.focus());
  }, k = () => {
    i && (!y && typeof i.close == "function" ? i.close() : i.removeAttribute("open"), o?.focus({ preventScroll: !!d }), d && (window.scrollTo(d), d = void 0));
  };
  return e.addEventListener("click", (c) => {
    if (!i) return;
    const f = c.target, m = f.closest("[data-doc-search-open]");
    m && O(m), f.closest("[data-doc-search-close]") && k();
    const v = f.closest("[data-doc-search-results] a");
    if (v) {
      const S = U(v.getAttribute("href") ?? void 0);
      r?.navigate && S?.navigable && (c.preventDefault(), r.navigate(S.href)), k();
    }
  }, { signal: t.signal }), e.addEventListener("input", (c) => {
    c.target.matches("[data-doc-search-input], [data-doc-search-filter]") && x();
  }, { signal: t.signal }), e.addEventListener("change", (c) => {
    c.target.matches("[data-doc-search-filter]") && x();
  }, { signal: t.signal }), e.addEventListener("keydown", (c) => {
    if (i) {
      if ((c.metaKey || c.ctrlKey) && c.key.toLowerCase() === "k") {
        c.preventDefault(), O(e.querySelector("[data-doc-search-open]") ?? void 0);
        return;
      }
      if (i?.hasAttribute("open")) {
        if (c.key === "Escape") {
          c.preventDefault(), k();
          return;
        }
        if (!(y && c.target !== h))
          if (c.key === "ArrowDown" || c.key === "ArrowUp") {
            c.preventDefault();
            const f = c.key === "ArrowDown" ? 1 : -1;
            n = Math.max(0, Math.min(s.length - 1, n + f)), E();
          } else c.key === "Enter" && s[n] && (c.preventDefault(), u?.children[n]?.querySelector("a")?.click());
      }
    }
  }, { signal: t.signal }), {
    refresh: () => {
      const c = i;
      i = e.querySelector(A), y = i?.dataset.docSearchPresentation === "inline", h = i?.querySelector("[data-doc-search-input]"), u = i?.querySelector("[data-doc-search-results]"), g = i?.querySelector("[data-doc-search-status]"), C = r?.records() ?? (i ? M(i) : []), b = i ? D(r?.contract?.() ?? N(i), a) : void 0, c !== i && (n = 0, d = void 0, o?.isConnected || (o = void 0)), x();
    },
    destroy: () => t.abort()
  };
}, se = (e) => {
  const a = new AbortController();
  return e.addEventListener("click", async (r) => {
    const t = r.target.closest("[data-doc-copy]");
    if (!t) return;
    const o = t.dataset.docCopy, n = o ? e.querySelector(`#${CSS.escape(o)}`) : t.closest("[data-doc-code]")?.querySelector("code");
    n && (await navigator.clipboard?.writeText(n.textContent ?? ""), t.dataset.docCopyState = "copied", t.setAttribute("aria-label", "Copied"));
  }, { signal: a.signal }), {
    refresh: () => {
    },
    destroy: () => a.abort()
  };
}, ie = (e, a = fetch) => {
  const r = new AbortController(), t = /* @__PURE__ */ new Map();
  return e.addEventListener("submit", (n) => {
    const s = n.target.closest("[data-doc-api-request]");
    if (!s || (n.preventDefault(), t.has(s))) return;
    const l = s.querySelector("[data-doc-api-status]"), d = s.querySelector("[data-doc-api-response]"), A = (i) => s.querySelector(`[name="${i}"]`)?.value ?? "";
    try {
      const i = s.dataset.apiOrigin ?? "", y = J(A("path"), {
        apiOrigin: i,
        allowedOrigins: [i]
      }), h = s.dataset.operationMethod?.toUpperCase() ?? "";
      if (![
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
      ].includes(h)) throw new Error("Unsupported request method");
      if (!s.querySelector('[name="confirm"]')?.checked) throw new Error("Confirm the displayed request destination");
      const u = A("token"), g = new Headers();
      u && g.set("authorization", u.startsWith("Bearer ") ? u : `Bearer ${u}`);
      const C = ["GET", "HEAD"].includes(h) ? void 0 : A("body");
      C && g.set("content-type", "application/json");
      const b = new AbortController();
      t.set(s, b), l && (l.textContent = "Sending…"), d && (d.textContent = ""), a(y.url, {
        method: h,
        headers: g,
        body: C || void 0,
        credentials: y.credentials,
        signal: b.signal
      }).then(async (p) => ({
        status: p.status,
        text: await p.text()
      })).then((p) => {
        b.signal.aborted || !s.isConnected || (l && (l.textContent = `HTTP ${p.status}`), d && (d.textContent = p.text.slice(0, 65536)));
      }).catch(() => {
        !b.signal.aborted && l && (l.textContent = "Response unavailable. The operation outcome may be unknown; check its owner before retrying.");
      }).finally(() => t.delete(s));
    } catch (i) {
      l && (l.textContent = i instanceof Error ? i.message : "Request unavailable");
    }
  }, { signal: r.signal }), {
    refresh: () => {
      for (const [n, s] of t) n.isConnected || (s.abort(), t.delete(n));
    },
    destroy: () => {
      r.abort();
      for (const n of t.values()) n.abort();
      t.clear();
    }
  };
}, ce = (e) => {
  const a = new AbortController(), r = (t) => {
    const o = t.closest('[role="tablist"]');
    if (o)
      for (const n of o.querySelectorAll('[role="tab"]')) {
        const s = n === t;
        n.setAttribute("aria-selected", String(s)), n.tabIndex = s ? 0 : -1;
        const l = n.getAttribute("aria-controls");
        if (l) {
          const d = e.querySelector(`#${CSS.escape(l)}`);
          d && (d.hidden = !s);
        }
      }
  };
  return e.addEventListener("click", (t) => {
    const o = t.target.closest('[role="tab"]');
    o && r(o);
  }, { signal: a.signal }), e.addEventListener("keydown", (t) => {
    const o = t.target.closest('[role="tab"]');
    if (!o) return;
    const n = [...o.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]:not([disabled])') ?? []], s = n.indexOf(o);
    let l = s;
    if (t.key === "ArrowRight" || t.key === "ArrowDown") l = (s + 1) % n.length;
    else if (t.key === "ArrowLeft" || t.key === "ArrowUp") l = (s - 1 + n.length) % n.length;
    else if (t.key === "Home") l = 0;
    else if (t.key === "End") l = n.length - 1;
    else return;
    t.preventDefault();
    const d = n[l];
    d && (r(d), d.focus());
  }, { signal: a.signal }), {
    refresh: () => L(e, '[role="tablist"]').forEach((t) => {
      const o = t.querySelector('[role="tab"][aria-selected="true"]') ?? t.querySelector('[role="tab"]');
      o && r(o);
    }),
    destroy: () => a.abort()
  };
}, j = "phoenix-assets:doc-shell:theme", B = /* @__PURE__ */ new Set([
  "system",
  "light",
  "dark",
  "contrast"
]), le = (e) => {
  try {
    const a = (e ?? localStorage).getItem(j);
    return a && B.has(a) ? a : "system";
  } catch {
    return "system";
  }
}, $ = (e, a) => {
  e.dataset.paTheme = a === "system" ? "" : a, e.dataset.docTheme = a;
}, de = (e, a) => {
  const r = new AbortController(), t = () => $(e, le(a));
  return e.addEventListener("click", (o) => {
    const n = o.target.closest("[data-doc-theme-value]")?.dataset.docThemeValue;
    if (!(!n || !B.has(n))) {
      try {
        (a ?? localStorage).setItem(j, n);
      } catch {
      }
      $(e, n);
    }
  }, { signal: r.signal }), t(), {
    refresh: t,
    destroy: () => r.abort()
  };
}, ue = (e) => {
  const a = [
    de(e),
    re(e),
    oe(e),
    se(e),
    ce(e),
    ie(e)
  ];
  return {
    refresh: () => a.forEach((r) => r.refresh()),
    destroy: () => a.splice(0).forEach((r) => r.destroy())
  };
}, fe = (e = document.documentElement) => {
  let a;
  const r = () => {
    a ??= ue(e);
  };
  return document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r, { once: !0 }) : r(), {
    refresh: () => a?.refresh(),
    destroy: () => {
      document.removeEventListener("DOMContentLoaded", r), a?.destroy(), a = void 0;
    }
  };
};
fe();
