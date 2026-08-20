import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const pagesBasePath = isGitHubPages && repositoryName ? `/${repositoryName}` : "";

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `img-src 'self' data: blob: https://*.tile.openstreetmap.org`,
  `connect-src 'self'`,
  `frame-ancestors 'none'`,
].join("; ");

const nextConfig: NextConfig = {
  // Local device/browser QA uses the machine's LAN address.
  allowedDevOrigins: ["127.0.0.1", "192.168.1.220"],

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
