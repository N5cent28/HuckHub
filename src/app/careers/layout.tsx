import type { Metadata } from "next";
import "./careers.css";

export const metadata: Metadata = {
  title: "HuckHub Careers",
  description: "Career networking for the ultimate frisbee community",
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="careers-root min-h-screen bg-slate-50 text-slate-900">{children}</div>
  );
}
