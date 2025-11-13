/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:slug*',
                destination: 'http://localhost:5001/api/:slug*',
            },
            {
                source: '/hubs/:slug*',
                destination: 'http://localhost:5001/api/:slug*',
            },
        ]
    },
}

module.exports = nextConfig
