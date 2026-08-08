import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { getRouteByPath } from "@/lib/routes";
import { RoutePage } from "@/app/workspace";

export const metadata: Metadata = {
  title: `${getRouteByPath("/expenses").title} | ${brand.appTitle}`,
};

export default function ExpensesPage() {
  return <RoutePage view="expenses" />;
}
