/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
 
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' data: blob:; img-src * 'unsafe-inline' data: blob:; frame-src *; style-src * 'unsafe-inline' data: blob:; font-src * 'unsafe-inline' data: blob:;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
