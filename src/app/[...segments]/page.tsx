import { notFound } from "next/navigation";
import Home from "@/app/page";
import { FEATURE_ROUTES, getViewForPath } from "@/lib/feature-routes";

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_ROUTES.map((route) => ({ segments: route.path.slice(1).split("/") }));
}

export default async function FeaturePage({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const view = getViewForPath(`/${segments.join("/")}`);
  if (!view) notFound();

  return <Home initialView={view} />;
}
