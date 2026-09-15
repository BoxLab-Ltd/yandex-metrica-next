import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    // Set only by the e2e run that rebuilds this app under a basePath.
    basePath: process.env.E2E_BASE_PATH,
}

export default nextConfig
