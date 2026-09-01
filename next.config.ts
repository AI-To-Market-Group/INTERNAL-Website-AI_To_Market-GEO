import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
  turbopack: {
    resolveAlias: {
      tailwindcss: path.resolve(__dirname, "node_modules/tailwindcss"),
      "tw-animate-css": path.resolve(__dirname, "node_modules/tw-animate-css/dist/tw-animate.css"),
    },
  },
  webpack: (config) => {
    const frontendDir = path.resolve(__dirname);
    const frontendNodeModules = path.join(frontendDir, "node_modules");

    config.context = frontendDir;
    config.resolve ??= {};
    config.resolve.modules = [frontendNodeModules, "node_modules"];
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss: path.join(frontendNodeModules, "tailwindcss"),
      "tw-animate-css": path.join(frontendNodeModules, "tw-animate-css", "dist", "tw-animate.css"),
    };
    config.resolveLoader = config.resolveLoader ?? {};
    config.resolveLoader.modules = [
      frontendNodeModules,
      ...(Array.isArray(config.resolveLoader.modules) ? config.resolveLoader.modules : ["node_modules"]),
    ];
    return config;
  },
};

export default nextConfig;
