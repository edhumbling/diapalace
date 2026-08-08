"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getRoleLandingPath } from "@/lib/routes";
import { LoadingScreen, LockScreen } from "@/app/workspace";

export default function LockPosPage() {
  const { user, isLoading, isLocked } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (!isLocked) {
      router.replace(getRoleLandingPath(user.role));
    }
  }, [isLoading, isLocked, router, user]);

  if (isLoading || !user || !isLocked) return <LoadingScreen />;

  return <LockScreen />;
}
