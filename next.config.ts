import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 複数のlockfileがある環境（git worktree等）でワークスペースルートを誤検出させない
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
