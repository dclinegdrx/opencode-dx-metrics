#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  DateRangeError,
  validateDate,
  validateTimezone,
} from "./date-range.js";
import {
  DxPayloadError,
  renderDxPayload,
  validatePilotEmail,
} from "./dx-payload.js";
import {
  OpenCodeReportError,
  OpenCodeStatsAdapter,
  TESTED_OPENCODE_VERSION,
} from "./opencode-adapter.js";

interface CliIO {
  stdout(message: string): void;
  stderr(message: string): void;
}

interface CliEnvironment {
  readonly DX_EMAIL?: string;
  readonly DX_API_URL?: string;
  readonly DX_API_TOKEN?: string;
}

class CliUsageError extends Error {
  override readonly name = "CliUsageError";
}

export async function run(
  argv: readonly string[],
  adapter = new OpenCodeStatsAdapter(),
  io: CliIO = {
    stdout: (message) => console.log(message),
    stderr: (message) => console.error(message),
  },
  environment: CliEnvironment = process.env,
): Promise<number> {
  try {
    const options = parseArguments(argv);
    const email = configuredEmail(environment);
    if (options.command === "doctor") {
      io.stderr(
        `Checking local prerequisites for ${options.date} in ${options.timezone} (adapter tested with ${TESTED_OPENCODE_VERSION}).`,
      );
      await adapter.report(options.date, options.timezone);
      io.stdout(
        JSON.stringify(
          {
            local_ready: true,
            identity: email,
            date: options.date,
            timezone: options.timezone,
            opencode: {
              reachable: true,
              compatible: true,
              tested_version: TESTED_OPENCODE_VERSION,
            },
            export_credentials: {
              endpoint_configured: configured(environment.DX_API_URL),
              token_configured: configured(environment.DX_API_TOKEN),
              required_for_dry_run: false,
            },
          },
          null,
          2,
        ),
      );
      return 0;
    }
    io.stderr(
      `Rendering an opencode-pilot payload for ${email} from aggregate OpenCode statistics for ${options.date} in ${options.timezone} (local dry-run only; adapter tested with ${TESTED_OPENCODE_VERSION}).`,
    );
    const summary = await adapter.report(options.date, options.timezone);
    io.stdout(renderDxPayload(summary, email));
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError || error instanceof DateRangeError) {
      io.stderr(error.message);
      io.stderr(usage());
      return 2;
    }
    if (error instanceof DxPayloadError) {
      io.stderr(`Payload validation failed: ${error.message}`);
      return 1;
    }
    if (error instanceof OpenCodeReportError) {
      io.stderr(`Report failed: ${error.message}`);
      return 1;
    }
    io.stderr("Report failed due to an unexpected local error.");
    return 1;
  }
}

function parseArguments(argv: readonly string[]): {
  command: "report" | "doctor";
  date: string;
  timezone: string;
} {
  const command = argv[0];
  if (command !== "report" && command !== "doctor") {
    throw new CliUsageError("Available commands are `report` and `doctor`.");
  }
  let date: string | undefined;
  let timezone: string | undefined;

  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run" && command === "report") continue;
    if (argument === "--date" || argument === "--timezone") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliUsageError(`${argument} requires a value.`);
      }
      if (argument === "--date") date = value;
      else timezone = value;
      index += 1;
      continue;
    }
    throw new CliUsageError(`Unknown argument: ${argument ?? ""}`);
  }

  if (date === undefined) throw new CliUsageError("--date is required.");
  if (timezone === undefined) {
    throw new CliUsageError("--timezone is required and has no host default.");
  }
  validateDate(date);
  validateTimezone(timezone);
  return { command, date, timezone };
}

function usage(): string {
  return [
    "Usage:",
    "  opencode-dx-metrics report --date YYYY-MM-DD --timezone IANA_TIMEZONE [--dry-run]",
    "  opencode-dx-metrics doctor --date YYYY-MM-DD --timezone IANA_TIMEZONE",
    "Configuration: DX_EMAIL is required; DX_API_URL and DX_API_TOKEN are presence-checked only by doctor.",
  ].join("\n");
}

function configuredEmail(environment: CliEnvironment): string {
  if (!configured(environment.DX_EMAIL)) {
    throw new CliUsageError(
      "DX_EMAIL is required and is never inferred from Git configuration.",
    );
  }
  try {
    validatePilotEmail(environment.DX_EMAIL);
  } catch {
    throw new CliUsageError(
      "DX_EMAIL must be a syntactically valid email address.",
    );
  }
  return environment.DX_EMAIL;
}

function configured(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await run(process.argv.slice(2));
}
