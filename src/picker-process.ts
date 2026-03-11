import { chromium, Browser, Frame } from "playwright-core";
import { readFileSync } from "fs";
import { join } from "path";
import { PickerWsServer, WsMessage } from "./ws-server.js";

export interface ElementInfo {
  tagName: string;
  id: string | null;
  role: string | null;
  ariaLabel: string | null;
  classList: string[];
  attributes: Record<string, string>;
  textContent: string;
  parentPath: string;
  outerHTML: string;
  frameChain: Array<{
    tagName: string;
    name: string | null;
    src: string | null;
  }> | null;
}

export interface PickerResult {
  exitCode: number; // 0=success, 1=timeout, 2=cdp-fail
  elementInfo?: ElementInfo;
  error?: string;
}

export interface PickerOptions {
  cdpPort: number;
  timeoutSec?: number;
  hint?: string;
}

/**
 * Build frame chain from Playwright's frame tree.
 * Uses the Frame API which has full access regardless of cross-origin restrictions.
 */
function buildFrameChain(
  frame: Frame
): Array<{ tagName: string; name: string | null; src: string | null }> {
  const chain: Array<{
    tagName: string;
    name: string | null;
    src: string | null;
  }> = [];
  let current: Frame | null = frame;
  while (current?.parentFrame()) {
    chain.unshift({
      tagName: "iframe",
      name: current.name() || null,
      src: current.url() || null,
    });
    current = current.parentFrame();
  }
  return chain;
}

export async function runPicker(options: PickerOptions): Promise<PickerResult> {
  const { cdpPort, timeoutSec = 60, hint } = options;

  let browser: Browser | null = null;
  let wsServer: PickerWsServer | null = null;

  try {
    // 1. Connect to browser via CDP
    try {
      browser = await chromium.connectOverCDP(
        `http://127.0.0.1:${cdpPort}`
      );
    } catch (err: any) {
      return {
        exitCode: 2,
        error: `CDP connection failed on port ${cdpPort}: ${err.message}`,
      };
    }

    // 2. Get first page from first context
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      return { exitCode: 2, error: "No browser contexts found via CDP" };
    }
    const pages = contexts[0].pages();
    if (pages.length === 0) {
      return { exitCode: 2, error: "No pages found via CDP" };
    }
    const page = pages[0];

    // 3. Start WS server and set up element-selected handler
    let resolveElement: ((info: ElementInfo) => void) | null = null;
    const elementPromise = new Promise<ElementInfo>((resolve) => {
      resolveElement = resolve;
    });

    wsServer = new PickerWsServer((msg: WsMessage) => {
      if (msg.type === "element-selected" && resolveElement) {
        const info: ElementInfo = msg.payload?.info ?? msg.payload;
        resolveElement(info);
        resolveElement = null;
      }
    });
    await wsServer.start();

    // 4. Read float-ball.js and template variables
    const scriptPath = join(__dirname, "injected", "float-ball.js");
    const baseScript = readFileSync(scriptPath, "utf-8")
      .replace(/__WS_PORT__/g, String(wsServer.port))
      .replace(/__WS_TOKEN__/g, wsServer.token)
      .replace(/__MODE__/g, "pick");

    const prepareForFrame = (frame: Frame) => {
      const chain = buildFrameChain(frame);
      return baseScript.replace(/__FRAME_CHAIN__/g, JSON.stringify(chain));
    };

    // 5. Inject into all frames
    for (const frame of page.frames()) {
      try {
        await frame.evaluate(prepareForFrame(frame));
      } catch {
        // Frame may be inaccessible (cross-origin without CDP) — skip
      }
    }

    // Re-inject when any frame navigates
    page.on("framenavigated", async (frame) => {
      try {
        await frame.waitForLoadState("domcontentloaded");
        await frame.evaluate(prepareForFrame(frame));
      } catch {
        // Frame may have detached or be inaccessible — ignore
      }
    });

    // 6. Send activate-picker via WS (wait briefly for client to connect)
    await new Promise((r) => setTimeout(r, 500));
    wsServer.send("activate-picker", hint ? { hint } : undefined);

    // 7. Wait for element-selected or timeout
    const timeoutMs = timeoutSec * 1000;
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const result = await Promise.race([elementPromise, timeoutPromise]);

    if (result === null) {
      return { exitCode: 1, error: `Timed out after ${timeoutSec}s` };
    }

    return { exitCode: 0, elementInfo: result };
  } finally {
    // 8. Cleanup
    wsServer?.stop();
    // Disconnect CDP handle (don't close the user's browser)
    try {
      await browser?.close();
    } catch {
      // Already disconnected — ignore
    }
  }
}
