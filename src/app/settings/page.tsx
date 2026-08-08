import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { getRouteByPath } from "@/lib/routes";
import { RoutePage } from "@/app/workspace";

export const metadata: Metadata = {
  title: `${getRouteByPath("/settings").title} | ${brand.appTitle}`,
};

export default function SettingsPage() {
  return <RoutePage view="settings" />;
}
