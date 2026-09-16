import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The floating dev-mode route indicator (bottom-left by default) can sit on
  // top of interactive elements in e2e tests, which run against `next dev`.
  devIndicators: false,
  experimental: {
    serverActions: {
      // Matches the trip-attachments storage bucket's 10 MB file_size_limit,
      // plus headroom for multipart/form-data boundary and field overhead.
      bodySizeLimit: "10.5mb",
    },
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    // Wraps the cron job declared in vercel.json with Sentry Cron Monitoring
    // (issue #25: monitor cron executions and reminder delivery failures).
    automaticVercelMonitors: true,
  },
});
