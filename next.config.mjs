/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client", "mammoth"],
  },
};

export default nextConfig;
