/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@libsql/client", "mammoth"],
};

export default nextConfig;
