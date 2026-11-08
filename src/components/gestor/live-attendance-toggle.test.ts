import { describe, expect, it, beforeEach } from "vitest";

// Mock de localStorage para ambiente Node no Vitest
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
};
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = localStorageMock;
}

import {
  LIVE_ATTENDANCE_STORAGE_KEY,
  LIVE_ATTENDANCE_EVENT_NAME,
  LIVE_ATTENDANCE_BC_CHANNEL,
  getStoredLiveAttendance,
  setStoredLiveAttendance,
} from "./live-attendance-toggle";

describe("Live Attendance Storage & Helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("possui chaves de armazenamento e eventos consistentes", () => {
    expect(LIVE_ATTENDANCE_STORAGE_KEY).toBe("triagem_live_attendance_active");
    expect(LIVE_ATTENDANCE_EVENT_NAME).toBe("triagem:attendance-toggle");
    expect(LIVE_ATTENDANCE_BC_CHANNEL).toBe("triagem_radio_sync");
  });

  it("inicia por padrão como ligado (true) na ausência de preferência", () => {
    expect(getStoredLiveAttendance()).toBe(true);
  });

  it("permite ligar e desligar salvando o estado no localStorage", () => {
    setStoredLiveAttendance(false);
    expect(getStoredLiveAttendance()).toBe(false);
    expect(localStorage.getItem(LIVE_ATTENDANCE_STORAGE_KEY)).toBe("false");

    setStoredLiveAttendance(true);
    expect(getStoredLiveAttendance()).toBe(true);
    expect(localStorage.getItem(LIVE_ATTENDANCE_STORAGE_KEY)).toBe("true");
  });
});
