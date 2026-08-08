import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { getRouteByPath } from "@/lib/routes";
import { RoutePage } from "@/app/workspace";

export const metadata: Metadata = {
  title: `${getRouteByPath("/purchases").title} | ${brand.appTitle}`,
};

export default function PurchasesPage() {
  return <RoutePage view="purchases" />;
}
