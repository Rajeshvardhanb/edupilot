import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser tests run a second dev server beside the normal one; each needs its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // A server deployment (scripts/deploy) builds a self-contained bundle: server.js plus only the packages it uses.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Only the app's own photo and logo folders may go through the image optimiser.
  // The development badge sat on top of the sidebar and the phone tab bar. Errors still show.
  devIndicators: false,
  // Keep the same Tailwind compilation when using `next build --webpack`.
  // This also supports build environments that restrict Turbopack's worker ports.
  webpack(config) {
    type Rule = { oneOf?: Rule[]; rules?: Rule[]; use?: unknown };
    const addTailwind = (rules: Rule[]) => {
      for (const rule of rules) {
        if (rule.oneOf) addTailwind(rule.oneOf);
        if (rule.rules) addTailwind(rule.rules);
        if (Array.isArray(rule.use) && rule.use.some((entry: unknown) =>
          typeof entry === "object" && entry !== null && "loader" in entry &&
          typeof entry.loader === "string" && entry.loader.includes("postcss-loader"))) {
          rule.use.push({ loader: "@tailwindcss/turbopack" });
        }
      }
    };
    addTailwind(config.module.rules);
    return config;
  },
  images: { localPatterns: [{ pathname: "/images/**" }, { pathname: "/brand/**" }] },
  // Baseline browser protections on every response.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  // Every screen is per-user and data-driven (attendance, marks, fees), so pages render
  // dynamically on each request. Cache Components / Partial Prefetching are left off.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
