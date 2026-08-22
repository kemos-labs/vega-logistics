import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const pagesBasePath = isGitHubPages && repositoryName ? `/${repositoryName}` : "";

// Turbopack dev needs eval for HMR; production builds do not.
// Fonts are self-hosted via next/font; no external origins are required.
const devUnsafeEval = process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${devUnsafeEval}`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self'`,
  `img-src 'self' data: blob:`,
  `connect-src 'self'`,
  `frame-ancestors 'none'`,
].join("; ");

const nextConfig: NextConfig = {
  // Client code (e.g. PDF font fetching) must respect the Pages basePath.
  env: { NEXT_PUBLIC_BASE_PATH: pagesBasePath },

  // Local device/browser QA uses the machine's LAN address; vega.localhost is
  // the portless proxy name (http://vega.localhost:8080).
  allowedDevOrigins: ["127.0.0.1", "192.168.1.220", "vega.localhost"],

  // Production output: standalone enables Docker/containerized deployments
  output: isGitHubPages ? "export" : "standalone",
  basePath: pagesBasePath,
  assetPrefix: pagesBasePath,
  trailingSlash: isGitHubPages,
  images: { unoptimized: isGitHubPages },

  // Remove the X-Powered-By header for security
  poweredByHeader: false,

  // Strict mode catches side-effects during development
  reactStrictMode: true,

  // GitHub Pages cannot apply response headers; server deployments keep them.
  ...(isGitHubPages ? {} : {
    async headers() {
      return [{
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      }];
    },
  }),

  // ── Packages that may need transpilation ─────────────────
  transpilePackages: [],

  experimental: {
    // ── Optimise commonly-used package imports ─────────────────
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
