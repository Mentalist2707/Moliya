"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { backDepth, onBackChange, popBack } from "@/lib/back";
import type { AllData } from "@/lib/types";
import type { FinSub, Tab } from "@/lib/nav";
import { api, StoreCtx, type Store } from "@/components/ui";
import { I } from "@/components/icons";
import Today from "@/components/Today";
import Tasks from "@/components/Tasks";
import Habits from "@/components/Habits";
import Finance from "@/components/Finance";
import Notes from "@/components/Notes";
import Books from "@/components/Books";
import Namoz, { type IbSub } from "@/components/Namoz";
import Settings, { Avatar, type Me } from "@/components/Settings";

// mobile: false — telefonda pastki menyuda yo'q (Odatlar → Vazifalar ichida)
const NAV: { id: Tab; label: string; short: string; icon: keyof typeof I; color: string; mobile?: false }[] = [
  { id: "bugun", label: "Bugun", short: "Bugun", icon: "today", color: "var(--brand)" },
  { id: "vazifalar", label: "Vazifalar", short: "Vazifa", icon: "tasks", color: "var(--tasks)" },
  { id: "odatlar", label: "Odatlar", short: "Odat", icon: "habit", color: "var(--habit)", mobile: false },
  { id: "moliya", label: "Moliya", short: "Moliya", icon: "money", color: "var(--money)" },
  { id: "namoz", label: "Ibodat", short: "Ibodat", icon: "mosque", color: "var(--habit)" },
  { id: "eslatmalar", label: "Eslatmalar", short: "Eslatma", icon: "notes", color: "var(--notes)" },
  { id: "kitoblar", label: "Kutubxona", short: "Kitob", icon: "books", color: "var(--books)" },
];
const FIN_SUBS: FinSub[] = ["tx", "crypto", "bills", "debts", "goals", "buy", "zakat"];

type TgWebApp = {
  ready: () => void;
  expand: () => void;
  colorScheme?: "light" | "dark";
  initData?: string;
  initDataUnsafe?: { user?: { id?: number; first_name?: string } };
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  disableVerticalSwipes?: () => void;
  onEvent?: (e: string, cb: () => void) => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  HapticFeedback?: { impactOccurred: (s: string) => void; notificationOccurred: (s: string) => void };
};
function tgApp(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  const w = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  return w && w.initData ? w : null;
}

const EMPTY: AllData = {
  goals: [],
  debts: [],
  purchases: [],
  payments: [],
  transactions: [],
  tasks: [],
  habits: [],
  habit_logs: [],
  notes: [],
  books: [],
  holdings: [],
  qaza: [],
  prayer_log: [],
  bills: [],
  budgets: [],
  birthdays: [],
  fast_log: [],
  quran: { page: 0, khatm: 0 },
  quran_log: [],
  zakat: null,
  qaza_log: [],
  tracking_since: null,
  reading_days: [],
  reading_speed: { pages: 0, minutes: 0 },
  quotes: [],
};

export default function Home() {
  const [data, setData] = useState<AllData | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState<Tab>("bugun");
  const [fin, setFin] = useState<FinSub>("tx");
  const [ib, setIb] = useState<IbSub>("namoz");
  // Orqaga: sahifalar tarixi (ichkaridan o'tilgan sahifalar) + ochiq oynalar soni
  const hist = useRef<string[]>([]);
  const cur = useRef("bugun");
  const [histLen, setHistLen] = useState(0);
  const [sheets, setSheets] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState(false);

  const reload = useCallback(async () => {
    try {
      setData(await api<AllData>("/api/state"));
      setLoadErr("");
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }, []);

  // Hash orqali yo'naltirish: #moliya, #moliya-debts …
  const readHash = useCallback(() => {
    const [t, s] = location.hash.slice(1).split("-");
    if (NAV.some((n) => n.id === t)) setTab(t as Tab);
    if (t === "moliya" && FIN_SUBS.includes(s as FinSub)) setFin(s as FinSub);
    if (t === "namoz") setIb(s === "roza" || s === "quron" ? s : "namoz");
    if (NAV.some((n) => n.id === t)) cur.current = location.hash.slice(1);
  }, []);

  useEffect(() => {
    readHash();
    (async () => {
      // Bitta telefonda bir nechta Telegram akkaunt bo'lsa, cookie umumiy bo'ladi.
      // Mini App'dagi akkaunt sessiyadagidan farq qilsa — shu akkaunt bilan qayta kiramiz.
      const w = tgApp();
      const tgId = w?.initDataUnsafe?.user?.id;
      const m = await api<Me>("/api/me").catch(() => null);
      if (w && tgId && String(m?.id ?? "") !== String(tgId)) {
        const key = "moliya_reauth_" + tgId;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          const r = await fetch("/api/tg-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: w.initData }) });
          if (r.ok) {
            location.reload();
            return;
          }
        }
        setLoadErr("Telegram akkauntingiz bilan kirib bo'lmadi. Ilovani yopib, qayta oching.");
        return;
      }
      if (tgId) sessionStorage.removeItem("moliya_reauth_" + tgId);
      if (m) setMe(m);
      reload();
    })();
    window.addEventListener("hashchange", readHash);
    // Boshqa oynadan qaytganda yangilash (masalan, botga xarajat yozgandan keyin)
    const onVis = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVis);

    // Telegram Mini App sozlamalari
    const w = tgApp();
    if (w) {
      w.ready();
      w.expand();
      w.disableVerticalSwipes?.();
      const apply = () => {
        document.documentElement.dataset.theme = w.colorScheme === "dark" ? "dark" : "light";
        const bg = getComputedStyle(document.body).backgroundColor;
        w.setHeaderColor?.(bg);
        w.setBackgroundColor?.(bg);
      };
      apply();
      w.onEvent?.("themeChanged", apply);
    }
    return () => {
      window.removeEventListener("hashchange", readHash);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload, readHash]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  /** mode: "push" — ichkaridan o'tish (orqaga qaytsa bo'ladi), "tab" — menyudan (tarix tozalanadi), "replace" — bo'lim almashishi, "back" */
  const nav = useCallback((t: Tab, sub: string | undefined, mode: "push" | "tab" | "replace" | "back") => {
    const key = t + (sub ? "-" + sub : "");
    if (mode === "push" && key !== cur.current) hist.current.push(cur.current);
    if (mode === "tab") hist.current = [];
    setHistLen(hist.current.length);
    cur.current = key;
    setTab(t);
    if (t === "moliya") setFin(sub && FIN_SUBS.includes(sub as FinSub) ? (sub as FinSub) : "tx");
    if (t === "namoz") setIb(sub === "roza" || sub === "quron" ? sub : "namoz");
    history.replaceState(null, "", "#" + key);
    if (mode !== "replace") window.scrollTo({ top: 0 });
  }, []);
  const go = useCallback((t: Tab, sub?: string) => nav(t, sub, "push"), [nav]);

  const back = useCallback(() => {
    if (popBack()) return; // avval ochiq oyna yopiladi
    const prev = hist.current.pop();
    if (prev) {
      const [t, s] = prev.split("-");
      nav(t as Tab, s, "back");
    } else if (cur.current !== "bugun") nav("bugun", undefined, "back");
  }, [nav]);
  const canBack = sheets > 0 || histLen > 0 || tab !== "bugun";

  useEffect(() => onBackChange(() => setSheets(backDepth())), []);

  // Telegram'ning tepadagi "Orqaga" tugmasi (Androidda telefonning orqaga tugmasi ham shu)
  useEffect(() => {
    const bb = tgApp()?.BackButton;
    if (!bb) return;
    if (canBack) bb.show();
    else bb.hide();
    bb.onClick(back);
    return () => bb.offClick(back);
  }, [canBack, back]);

  const store: Store = useMemo(
    () => ({
      d: data ?? EMPTY,
      reload,
      toast: setToastMsg,
      haptic: (k = "light") => {
        const h = tgApp()?.HapticFeedback;
        if (!h) return;
        if (k === "success") h.notificationOccurred("success");
        else h.impactOccurred("light");
      },
      act: async (fn, msg) => {
        try {
          await fn();
          if (msg) setToastMsg(msg);
        } catch (e) {
          setToastMsg("Xatolik: " + (e as Error).message);
          throw e;
        } finally {
          await reload();
        }
      },
    }),
    [data, reload]
  );

  const current = NAV.find((n) => n.id === tab)!;

  return (
    <StoreCtx.Provider value={store}>
      <div className="shell" style={{ "--c": current.color } as React.CSSProperties}>
        <nav className="side" aria-label="Bo'limlar">
          <div className="logo">
            <i>M</i>Moliya
          </div>
          {NAV.map((n) => {
            const Ic = I[n.icon];
            return (
              <button key={n.id} className="navbtn" aria-current={tab === n.id ? "page" : undefined} style={{ "--c": n.color } as React.CSSProperties} onClick={() => nav(n.id, undefined, "tab")}>
                <Ic />
                {n.label}
              </button>
            );
          })}
          <div className="spacer" />
          {me && (
            <button className="navbtn" onClick={() => setSettings(true)} style={{ minHeight: 56 }}>
              <Avatar me={me} size={30} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.first_name || "Sozlamalar"}</span>
            </button>
          )}
        </nav>

        <main className="main">
          <div className="content">
            {data && (histLen > 0 || tab !== "bugun") && (
              <button className="backbtn" onClick={back}>
                <span aria-hidden="true">‹</span> Orqaga
              </button>
            )}
            {loadErr && (
              <div className="card">
                <div className="empty">
                  <b>⚠️</b>
                  <span>Ma&apos;lumotlarni yuklab bo&apos;lmadi: {loadErr}</span>
                  <button className="btn sm" onClick={reload}>
                    Qayta urinish
                  </button>
                </div>
              </div>
            )}
            {!data && !loadErr && (
              <>
                <div className="skeleton" style={{ height: 150 }} />
                <div className="skeleton" />
                <div className="skeleton" />
              </>
            )}
            {data && tab === "bugun" && <Today go={go} me={me} openSettings={() => setSettings(true)} />}
            {data && tab === "vazifalar" && <Tasks />}
            {data && tab === "odatlar" && <Habits />}
            {data && tab === "moliya" && <Finance sub={fin} setSub={(s) => nav("moliya", s, "replace")} />}
            {data && tab === "namoz" && <Namoz openSettings={() => setSettings(true)} quranGoal={me?.quran_goal ?? 0} seg={ib} setSeg={(v) => nav("namoz", v === "namoz" ? undefined : v, "replace")} />}
            {data && tab === "eslatmalar" && <Notes />}
            {data && tab === "kitoblar" && <Books me={me} setMe={setMe} />}
          </div>
        </main>

        <nav className="bottom" aria-label="Bo'limlar">
          {NAV.filter((n) => n.mobile !== false).map((n) => {
            const Ic = I[n.icon];
            return (
              <button
                key={n.id}
                aria-current={tab === n.id || (n.id === "vazifalar" && tab === "odatlar") ? "page" : undefined}
                style={{ "--c": n.color } as React.CSSProperties}
                onClick={() => nav(n.id, undefined, "tab")}
              >
                <Ic />
                {n.short}
              </button>
            );
          })}
        </nav>
      </div>
      {settings && me && <Settings me={me} onChange={setMe} onClose={() => setSettings(false)} />}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </StoreCtx.Provider>
  );
}
