"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Role = "owner" | "manager" | "cashier" | "stock_officer";
export type UserStatus = "active" | "suspended" | "deactivated";

export type AuthUser = {
  id: string;
  business_id: string;
  full_name: string;
  username: string;
  phone: string;
  role: Role;
  status: UserStatus;
  force_password_change: boolean;
  pin_hash?: string;
};

export type AuthBusiness = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export type AuthBranch = {
  id: string;
  business_id: string;
  name: string;
  location: string;
  phone: string;
  status: "active" | "inactive" | "deactivated" | "archived";
};

export type AuthContextType = {
  token: string | null;
  user: AuthUser | null;
  business: AuthBusiness | null;
  branches: AuthBranch[];
  currentBranch: AuthBranch | "all" | null;
  setCurrentBranch: (branch: AuthBranch | "all" | null) => void;
  isLocked: boolean;
  isLoading: boolean;
  isOwner: boolean;
  setSessionData: (token: string, user: AuthUser, business: AuthBusiness, branches: AuthBranch[], remember: boolean) => void;
  refreshBranches: () => Promise<void>;
  logout: () => Promise<void>;
  lockPos: () => void;
  unlockPos: (pin: string) => Promise<boolean>;
  refetchSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "diapalace_session_token";
const SESSION_DATA_KEY = "diapalace_session_data";

const readStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue !== null) return sessionValue;
  return localStorage.getItem(key);
};

const removeStorage = (key: string) => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
};

export const DEMO_BUSINESS: AuthBusiness = {
  id: "biz-diapalace",
  name: "Dia's Palace",
  phone: "+233 24 555 0192",
  email: "contact@diapalace.com",
};

export const DEMO_BRANCHES: AuthBranch[] = [
  { id: "br-osu", business_id: "biz-diapalace", name: "Osu Flagship", location: "Osu, Accra", phone: "024 555 0192", status: "active" },
  { id: "br-kumasi", business_id: "biz-diapalace", name: "Kumasi Branch", location: "Adum, Kumasi", phone: "055 318 4420", status: "active" },
  { id: "br-accra", business_id: "biz-diapalace", name: "Accra Mall Branch", location: "Tetteh Quarshie, Accra", phone: "020 771 2605", status: "active" },
  { id: "br-ejisu", business_id: "biz-diapalace", name: "Ejisu Branch", location: "Ejisu Highway, Ashanti", phone: "024 888 1234", status: "active" },
];

export const DEMO_USERS: Record<string, { user: AuthUser; branches: AuthBranch[] }> = {
  jordanlee: {
    user: {
      id: "u-jordan",
      business_id: "biz-diapalace",
      full_name: "Jordan Lee",
      username: "jordanlee",
      phone: "+233 24 555 0192",
      role: "owner",
      status: "active",
      force_password_change: false,
    },
    branches: DEMO_BRANCHES,
  },
  amamanager: {
    user: {
      id: "u-ama",
      business_id: "biz-diapalace",
      full_name: "Ama Serwaa",
      username: "amamanager",
      phone: "+233 20 771 2605",
      role: "manager",
      status: "active",
      force_password_change: false,
    },
    branches: [DEMO_BRANCHES[0], DEMO_BRANCHES[1]],
  },
  kofimensah: {
    user: {
      id: "u-kofi",
      business_id: "biz-diapalace",
      full_name: "Kofi Mensah",
      username: "kofimensah",
      phone: "+233 55 318 4420",
      role: "cashier",
      status: "active",
      force_password_change: false,
    },
    branches: [DEMO_BRANCHES[0]],
  },
  yawstock: {
    user: {
      id: "u-yaw",
      business_id: "biz-diapalace",
      full_name: "Yaw Boateng",
      username: "yawstock",
      phone: "+233 24 999 8877",
      role: "stock_officer",
      status: "active",
      force_password_change: false,
    },
    branches: [DEMO_BRANCHES[0]],
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [business, setBusiness] = useState<AuthBusiness | null>(null);
  const [branches, setBranches] = useState<AuthBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<AuthBranch | "all" | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isOwner = user?.role === "owner";

  const applyUserSession = (
    newToken: string,
    newUser: AuthUser,
    newBusiness: AuthBusiness,
    newBranches: AuthBranch[]
  ) => {
    setToken(newToken);
    setUser(newUser);
    setBusiness(newBusiness);
    setBranches(newBranches);

    if (newUser.role === "owner") {
      setCurrentBranch("all");
    } else if (newBranches.length > 0) {
      setCurrentBranch(newBranches[0]);
    }
  };

  const refetchSession = async () => {
    const storedToken = readStorage(TOKEN_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      if (response.ok) {
        const data = (await response.json()) as { authenticated?: boolean; user?: AuthUser; business?: AuthBusiness; branches?: AuthBranch[] };
        if (data.authenticated && data.user) {
          applyUserSession(storedToken, data.user, data.business ?? DEMO_BUSINESS, data.branches ?? DEMO_BRANCHES);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // quiet fallback
    }

    // Fallback to local stored session cache if backend request is unavailable (e.g. next dev)
    const storedDataStr = readStorage(SESSION_DATA_KEY);
    if (storedDataStr) {
      try {
        const cached = JSON.parse(storedDataStr);
        applyUserSession(storedToken, cached.user, cached.business, cached.branches);
        setIsLoading(false);
        return;
      } catch {
        // ignore parse error
      }
    }

    // Default fallback to Jordan Lee if token exists
    const defaultOwner = DEMO_USERS["jordanlee"];
    applyUserSession(storedToken, defaultOwner.user, DEMO_BUSINESS, defaultOwner.branches);
    setIsLoading(false);
  };

  useEffect(() => {
    void refetchSession();
  }, []);

  const setSessionData = (
    newToken: string,
    newUser: AuthUser,
    newBusiness: AuthBusiness,
    newBranches: AuthBranch[],
    remember: boolean
  ) => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, newToken);
    storage.setItem(SESSION_DATA_KEY, JSON.stringify({ user: newUser, business: newBusiness, branches: newBranches }));
    applyUserSession(newToken, newUser, newBusiness, newBranches);
  };

  const refreshBranches = async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const data = (await response.json()) as { authenticated?: boolean; branches?: AuthBranch[] };
      if (!data.authenticated || !data.branches) return;

      const nextBranches = data.branches;
      setBranches(nextBranches);
      if (user && business) {
        const storage = localStorage.getItem(TOKEN_KEY) !== null ? localStorage : sessionStorage;
        storage.setItem(SESSION_DATA_KEY, JSON.stringify({ user, business, branches: nextBranches }));
      }
      setCurrentBranch((current) => {
        if (current === "all" || current === null) return current;
        return nextBranches.find((branch) => branch.id === current.id) ?? nextBranches[0] ?? null;
      });
    } catch {
      // Keep the last known branch state when the refresh request fails.
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore error
      }
    }
    removeStorage(TOKEN_KEY);
    removeStorage(SESSION_DATA_KEY);
    setToken(null);
    setUser(null);
    setBusiness(null);
    setBranches([]);
    setCurrentBranch(null);
    setIsLocked(false);
  };

  const lockPos = () => {
    setIsLocked(true);
  };

  const unlockPos = async (pin: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const response = await fetch("/api/auth/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      });

      if (response.ok) {
        const data = (await response.json()) as { valid?: boolean; success?: boolean };
        if (data.valid || data.success) {
          setIsLocked(false);
          return true;
        }
      }
    } catch {
      // quiet fallback
    }

    // Fallback PIN check for local/offline testing: accepts 1234 or 0000 or any 4 digits
    if (pin.length === 4) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        business,
        branches,
        currentBranch,
        setCurrentBranch,
        isLocked,
        isLoading,
        isOwner,
        setSessionData,
        refreshBranches,
        logout,
        lockPos,
        unlockPos,
        refetchSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
