#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  DateRangeError,
  validateDate,
  validateTimezone,
} from "./date-range.js";
import {
  OpenCodeReportError,
  OpenCodeStatsAdapter,
  TESTED_OPENCODE_VERSION,
} from "./opencode-adapter.js";

interface CliIO {
  stdout(message: string): void;
  stderr(message: string): void;
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
): Promise<number> {
  try {
    const options = parseArguments(argv);
    io.stderr(
      `Reading aggregate OpenCode statistics for ${options.date} in ${options.timezone} (local dry-run only; adapter tested with ${TESTED_OPENCODE_VERSION}).`,
    );
    const summary = await adapter.report(options.date, options.timezone);
    io.stdout(JSON.stringify(summary, null, 2));
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError || error instanceof DateRangeError) {
      io.stderr(error.message);
      io.stderr(usage());
      return 2;
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
  date: string;
  timezone: string;
} {
  if (argv[0] !== "report") {
    throw new CliUsageError("The only available command is `report`.");
  }
  let date: string | undefined;
  let timezone: string | undefined;

  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") continue;
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
  return { date, timezone };
}

function usage(): string {
  return "Usage: opencode-dx-metrics report --date YYYY-MM-DD --timezone IANA_TIMEZONE [--dry-run]";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await run(process.argv.slice(2));
}
