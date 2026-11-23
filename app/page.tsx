"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import Namoz from "@/components/Namoz";
import Settings, { Avatar, type Me } from "@/components/Settings";

// mobile: false — telefonda pastki menyuda yo'q (Odatlar → Vazifalar ichida)
const NAV: { id: Tab; label: string; short: string; icon: keyof typeof I; color: string; mobile?: false }[] = [
  { id: "bugun", label: "Bugun", short: "Bugun", icon: "today", color: "var(--brand)" },
  { id: "vazifalar", label: "Vazifalar", short: "Vazifa", icon: "tasks", color: "var(--tasks)" },
  { id: "odatlar", label: "Odatlar", short: "Odat", icon: "habit", color: "var(--habit)", mobile: false },
  { id: "moliya", label: "Moliya", short: "Moliya", icon: "money", color: "var(--money)" },
  { id: "namoz", label: "Namoz", short: "Namoz", icon: "mosque", color: "var(--habit)" },
  { id: "eslatmalar", label: "Eslatmalar", short: "Eslatma", icon: "notes", color: "var(--notes)" },
  { id: "kitoblar", label: "Kutubxona", short: "Kitob", icon: "books", color: "var(--books)" },
];
const FIN_SUBS: FinSub[] = ["tx", "crypto", "debts", "goals", "buy"];

type TgWebApp = {
  ready: () => void;
  expand: () => void;
  colorScheme?: "light" | "dark";
  initData?: string;
  initDataUnsafe?: { user?: { first_name?: string } };
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  disableVerticalSwipes?: () => void;
  onEvent?: (e: string, cb: () => void) => void;
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
};

export default function Home() {
  const [data, setData] = useState<AllData | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState<Tab>("bugun");
  const [fin, setFin] = useState<FinSub>("tx");
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
  }, []);

  useEffect(() => {
    reload();
    readHash();
    api<Me>("/api/me").then(setMe).catch(() => {});
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

  const go = useCallback((t: Tab, sub?: string) => {
    setTab(t);
    if (t === "moliya" && sub && FIN_SUBS.includes(sub as FinSub)) setFin(sub as FinSub);
    history.replaceState(null, "", "#" + t + (t === "moliya" && sub ? "-" + sub : ""));
    window.scrollTo({ top: 0 });
  }, []);

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
              <button key={n.id} className="navbtn" aria-current={tab === n.id ? "page" : undefined} style={{ "--c": n.color } as React.CSSProperties} onClick={() => go(n.id)}>
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
            {data && tab === "moliya" && <Finance sub={fin} setSub={(s) => go("moliya", s)} />}
            {data && tab === "namoz" && <Namoz openSettings={() => setSettings(true)} />}
            {data && tab === "eslatmalar" && <Notes />}
            {data && tab === "kitoblar" && <Books />}
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
                onClick={() => go(n.id)}
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
