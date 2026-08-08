import { notFound } from "next/navigation";
import Home from "@/app/page";
import { getViewForPath } from "@/lib/feature-routes";

const branchIds = ["br-osu", "br-kumasi", "br-accra", "br-ejisu"];
const featureSlugs = ["dashboard", "new-sale", "sales", "inventory", "cash-up", "stock-transfers", "reports", "employees", "branches", "notifications", "audit-trail", "settings", "customers", "purchases", "expenses"];

export const dynamicParams = false;

export function generateStaticParams() {
  return branchIds.flatMap((branchId) => featureSlugs.map((feature) => ({ segments: [branchId, feature] })));
}

export default async function BranchPage({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const view = getViewForPath(`/branches/${segments.join("/")}`);
  if (!view) notFound();
  return <Home initialView={view} />;
}
