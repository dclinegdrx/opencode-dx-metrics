import { OpenCode } from "@opencode/client";
import { Service, type Endpoint } from "@opencode/client/service";
import { setTimeout as delay } from "node:timers/promises";

import type { DailySummary } from "./contracts.js";
import { dateRange } from "./date-range.js";
import { parseSessionStats, StatsCompatibilityError } from "./session-stats.js";

export const TESTED_OPENCODE_VERSION = "2.0.5";
export const DEFAULT_LOCAL_TIMEOUT_MS = 5_000;

interface ServiceStatus {
  version: string;
}

interface LocalClient {
  status(signal: AbortSignal): Promise<ServiceStatus>;
  stats(
    input: {
      from: number;
      to: number;
      timezone: string;
      tools: "summary";
    },
    signal: AbortSignal,
  ): Promise<unknown>;
}

export interface OpenCodeAdapterDependencies {
  discover(): Promise<Endpoint | undefined>;
  connect(endpoint: Endpoint): LocalClient;
}

export class OpenCodeReportError extends Error {
  override readonly name = "OpenCodeReportError";
}

export class OpenCodeStatsAdapter {
  constructor(
    private readonly dependencies: OpenCodeAdapterDependencies = defaults,
    private readonly timeoutMs = DEFAULT_LOCAL_TIMEOUT_MS,
  ) {}

  async report(date: string, timezone: string): Promise<DailySummary> {
    const range = dateRange(date, timezone);
    const endpoint = await this.discover();
    const client = this.dependencies.connect(endpoint);
    const signal = AbortSignal.timeout(this.timeoutMs);

    try {
      const status = await client.status(signal);
      if (status.version !== TESTED_OPENCODE_VERSION) {
        throw new OpenCodeReportError(
          `Unsupported local OpenCode version. This prototype is tested with ${TESTED_OPENCODE_VERSION}; update the adapter only after validating the experimental session-stats contract.`,
        );
      }
      const response = await client.stats(
        { ...range, timezone, tools: "summary" },
        signal,
      );
      return parseSessionStats(response, { date, timezone, range });
    } catch (error) {
      if (error instanceof OpenCodeReportError) throw error;
      if (error instanceof StatsCompatibilityError) {
        throw new OpenCodeReportError(
          `${error.message} Verify OpenCode ${TESTED_OPENCODE_VERSION} is installed, then update the adapter if its experimental API changed.`,
        );
      }
      if (signal.aborted) {
        throw new OpenCodeReportError(
          `The local OpenCode request timed out after ${this.timeoutMs} ms. Check \`opencode service status\` and try again.`,
        );
      }
      throw new OpenCodeReportError(
        "Could not query the local OpenCode service. Check `opencode service status`, confirm it is healthy, and try again.",
      );
    }
  }

  private async discover(): Promise<Endpoint> {
    try {
      const endpoint = await Promise.race([
        this.dependencies.discover(),
        delay(this.timeoutMs, undefined, { ref: false }),
      ]);
      if (endpoint === undefined) {
        throw new OpenCodeReportError(
          "No healthy local OpenCode service was discovered. Start OpenCode normally, check `opencode service status`, and try again.",
        );
      }
      assertLoopbackEndpoint(endpoint);
      return endpoint;
    } catch (error) {
      if (error instanceof OpenCodeReportError) throw error;
      throw new OpenCodeReportError(
        "Local OpenCode service discovery failed. Check `opencode service status` and try again.",
      );
    }
  }
}

function assertLoopbackEndpoint(endpoint: Endpoint): void {
  let url: URL;
  try {
    url = new URL(endpoint.url);
  } catch {
    throw new OpenCodeReportError(
      "The discovered OpenCode service endpoint is invalid. Check `opencode service status` and try again.",
    );
  }
  if (
    url.protocol !== "http:" ||
    (url.hostname !== "127.0.0.1" && url.hostname !== "[::1]")
  ) {
    throw new OpenCodeReportError(
      "The discovered OpenCode service is not a local loopback endpoint. Refusing the request to preserve local-only reporting.",
    );
  }
}

const defaults: OpenCodeAdapterDependencies = {
  discover: async () => {
    const endpoint = await Service.discover();
    if (endpoint === undefined) return undefined;
    return endpoint.auth === undefined
      ? { url: endpoint.url }
      : { url: endpoint.url, auth: endpoint.auth };
  },
  connect: (endpoint) => {
    const client = OpenCode.make({
      baseUrl: endpoint.url,
      headers: Service.headers(endpoint),
    });
    return {
      status: (signal) => client.server.status({ signal }),
      stats: (input, signal) => client.session.stats(input, { signal }),
    };
  },
};
