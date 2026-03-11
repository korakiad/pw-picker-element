import minimist from "minimist";
import { runPicker } from "./picker-process.js";

export interface CliArgs {
  command: string;
  cdpPort: number;
  timeout: number;
  hint?: string;
  error?: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const parsed = minimist(argv, {
    string: ["cdp", "hint"],
    default: { timeout: 60 },
  });

  const command = parsed._[0];

  if (!command) {
    return {
      command: "",
      cdpPort: 0,
      timeout: 60,
      error: "No command specified. Usage: playwright-picker pick --cdp <port>",
    };
  }

  if (command !== "pick") {
    return {
      command,
      cdpPort: 0,
      timeout: 60,
      error: `Unknown command: ${command}. Valid commands: pick`,
    };
  }

  const cdpRaw = parsed.cdp;
  if (cdpRaw === undefined || cdpRaw === "") {
    return {
      command,
      cdpPort: 0,
      timeout: 60,
      error: "Missing required flag: --cdp <port>",
    };
  }

  const cdpPort = Number(cdpRaw);
  if (!Number.isFinite(cdpPort) || cdpPort <= 0) {
    return {
      command,
      cdpPort: 0,
      timeout: 60,
      error: `Invalid --cdp value: ${cdpRaw}. Must be a positive number.`,
    };
  }

  const timeout = Number(parsed.timeout) || 60;

  return {
    command,
    cdpPort,
    timeout,
    ...(parsed.hint ? { hint: parsed.hint } : {}),
  };
}

export async function main(argv?: string[]): Promise<void> {
  const args = parseArgs(argv ?? process.argv.slice(2));

  if (args.error) {
    process.stderr.write(args.error + "\n");
    process.exit(2);
  }

  const result = await runPicker({
    cdpPort: args.cdpPort,
    timeoutSec: args.timeout,
    hint: args.hint,
  });

  if (result.exitCode === 0) {
    process.stdout.write(JSON.stringify(result.elementInfo, null, 2) + "\n");
  }

  if (result.error) {
    process.stderr.write(result.error + "\n");
  }

  process.exit(result.exitCode);
}

// Only auto-run when executed directly (not when imported by tests/other modules).
// Vitest sets VITEST=true and VITEST_WORKER_ID in worker processes.
const isTestEnv = typeof process !== "undefined" && (process.env.VITEST || process.env.VITEST_WORKER_ID);

if (!isTestEnv) {
  main().catch((err) => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(2);
  });
}
