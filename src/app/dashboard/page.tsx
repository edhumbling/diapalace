import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { getRouteByPath } from "@/lib/routes";
import { RoutePage } from "@/app/workspace";

export const metadata: Metadata = {
  title: `${getRouteByPath("/dashboard").title} | ${brand.appTitle}`,
};

export default function DashboardPage() {
  return <RoutePage view="dashboard" />;
}
