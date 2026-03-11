import { describe, it, expect } from "vitest";
import { runPicker, PickerResult } from "../src/picker-process.js";

describe("picker-process", () => {
  it("returns exitCode 2 when CDP connection fails", async () => {
    // Use a port that nothing listens on
    const result: PickerResult = await runPicker({ cdpPort: 1, timeoutSec: 5 });
    expect(result.exitCode).toBe(2);
    expect(result.error).toMatch(/CDP connection failed/);
    expect(result.elementInfo).toBeUndefined();
  });

  it("returns exitCode 2 for unreachable port", async () => {
    // A high unlikely-bound port
    const result: PickerResult = await runPicker({
      cdpPort: 59999,
      timeoutSec: 5,
    });
    expect(result.exitCode).toBe(2);
    expect(result.error).toBeDefined();
  });
});
