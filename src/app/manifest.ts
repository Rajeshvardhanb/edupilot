import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EduPilot — College ERP",
    short_name: "EduPilot",
    description: "Attendance, results, fees and more for Engineering & Diploma colleges",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f6fb",
    theme_color: "#2f5bea",
    icons: [{ src: "/brand/mark-192.png", sizes: "192x192", type: "image/png" }, { src: "/brand/mark.png", sizes: "512x512", type: "image/png" }],
  };
}
