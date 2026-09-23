import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
  serverExternalPackages: ["better-sqlite3", "argon2", "pdfkit", "bidi-shaper"],
  async redirects() {
    return [
      { source: "/student/chat", destination: "/student/messenger", permanent: false },
      { source: "/student/courses", destination: "/student/school", permanent: false },
      { source: "/student/books", destination: "/student/library", permanent: false },
    ];
  },
};

export default nextConfig;
