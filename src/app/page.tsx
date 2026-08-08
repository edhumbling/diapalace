"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getRoleLandingPath } from "@/lib/routes";
import { LoadingScreen } from "@/app/workspace";

export default function IndexPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? getRoleLandingPath(user.role) : "/login");
  }, [isLoading, router, user]);

  return <LoadingScreen />;
}
