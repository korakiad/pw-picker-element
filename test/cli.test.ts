import { describe, it, expect } from "vitest";
import { parseArgs, CliArgs } from "../src/cli.js";

describe("parseArgs", () => {
  it("parses --cdp flag", () => {
    const result = parseArgs(["pick", "--cdp", "9222"]);
    expect(result.command).toBe("pick");
    expect(result.cdpPort).toBe(9222);
    expect(result.error).toBeUndefined();
  });

  it("defaults timeout to 60", () => {
    const result = parseArgs(["pick", "--cdp", "9222"]);
    expect(result.timeout).toBe(60);
  });

  it("parses --hint and --timeout", () => {
    const result = parseArgs([
      "pick",
      "--cdp",
      "9222",
      "--timeout",
      "30",
      "--hint",
      "click the login button",
    ]);
    expect(result.cdpPort).toBe(9222);
    expect(result.timeout).toBe(30);
    expect(result.hint).toBe("click the login button");
    expect(result.error).toBeUndefined();
  });

  it("returns error when --cdp is missing", () => {
    const result = parseArgs(["pick"]);
    expect(result.error).toMatch(/Missing required flag: --cdp/);
  });

  it("returns error for unknown command", () => {
    const result = parseArgs(["launch", "--cdp", "9222"]);
    expect(result.error).toMatch(/Unknown command: launch/);
  });

  it("returns error when no command is given", () => {
    const result = parseArgs([]);
    expect(result.error).toMatch(/No command specified/);
  });

  it("returns error for non-numeric --cdp", () => {
    const result = parseArgs(["pick", "--cdp", "abc"]);
    expect(result.error).toMatch(/Invalid --cdp value/);
  });
});
