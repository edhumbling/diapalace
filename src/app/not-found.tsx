import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Page not found | ${brand.appTitle}`,
};

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
        <img src={brand.logo} alt={brand.businessName} className="brand-logo" style={{ width: "3rem", height: "3rem", margin: "0 auto 1rem" }} />
        <h2 style={{ color: "#fff" }}>Page not found</h2>
        <p style={{ color: "#9eb0c1", fontSize: ".9rem", marginTop: ".5rem", lineHeight: 1.5 }}>
          The page you requested does not exist or has moved. Use the menu to reach your destination.
        </p>
        <Link
          href="/dashboard"
          className="button primary"
          style={{ display: "inline-flex", marginTop: "1.5rem", textDecoration: "none" }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
