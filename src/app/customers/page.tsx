import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { getRouteByPath } from "@/lib/routes";
import { RoutePage } from "@/app/workspace";

export const metadata: Metadata = {
  title: `${getRouteByPath("/customers").title} | ${brand.appTitle}`,
};

export default function CustomersPage() {
  return <RoutePage view="customers" />;
}
