import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { getRouteByPath } from "@/lib/routes";
import { RoutePage } from "@/app/workspace";

export const metadata: Metadata = {
  title: `${getRouteByPath("/sales/new").title} | ${brand.appTitle}`,
};

export default function NewSalePage() {
  return <RoutePage view="checkout" />;
}
