"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getRoleLandingPath } from "@/lib/routes";
import { AuthScreen, LoadingScreen } from "@/app/workspace";

export default function LoginPage() {
  const { user, isLoading, setSessionData } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) router.replace(getRoleLandingPath(user.role));
  }, [isLoading, router, user]);

  if (isLoading || user) return <LoadingScreen />;

  return <AuthScreen onLoginSuccess={setSessionData} notify={() => {}} />;
}
