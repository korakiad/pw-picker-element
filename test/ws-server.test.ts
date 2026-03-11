import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { PickerWsServer, WsMessage } from "../src/ws-server.js";

describe("PickerWsServer", () => {
  let server: PickerWsServer;

  afterEach(() => {
    server?.stop();
  });

  function connectClient(
    port: number,
    token: string
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}?token=${token}`
      );
      ws.on("open", () => resolve(ws));
      ws.on("error", reject);
    });
  }

  it("accepts connection with valid token", async () => {
    const messages: WsMessage[] = [];
    let connected = false;
    server = new PickerWsServer(
      (msg) => messages.push(msg),
      () => { connected = true; }
    );
    await server.start();
    expect(server.port).toBeGreaterThan(0);

    const client = await connectClient(server.port, server.token);
    // Give the server a moment to process the connection
    await new Promise((r) => setTimeout(r, 50));

    expect(connected).toBe(true);
    expect(server.hasClient()).toBe(true);

    client.close();
  });

  it("rejects connection with invalid token (close code 4001)", async () => {
    server = new PickerWsServer(() => {});
    await server.start();

    const ws = new WebSocket(
      `ws://127.0.0.1:${server.port}?token=bad-token`
    );

    const closeCode = await new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
    });

    expect(closeCode).toBe(4001);
    expect(server.hasClient()).toBe(false);
  });

  it("routes messages to onMessage callback", async () => {
    const messages: WsMessage[] = [];
    server = new PickerWsServer((msg) => messages.push(msg));
    await server.start();

    const client = await connectClient(server.port, server.token);
    await new Promise((r) => setTimeout(r, 50));

    client.send(JSON.stringify({ type: "element-selected", payload: { id: "btn" } }));
    await new Promise((r) => setTimeout(r, 50));

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("element-selected");
    expect(messages[0].payload).toEqual({ id: "btn" });

    client.close();
  });

  it("sends messages to connected client", async () => {
    server = new PickerWsServer(() => {});
    await server.start();

    const client = await connectClient(server.port, server.token);
    await new Promise((r) => setTimeout(r, 50));

    const received = new Promise<WsMessage>((resolve) => {
      client.on("message", (raw) => {
        resolve(JSON.parse(raw.toString()));
      });
    });

    server.send("activate-picker", { hint: "click the button" });
    const msg = await received;

    expect(msg.type).toBe("activate-picker");
    expect(msg.payload).toEqual({ hint: "click the button" });

    client.close();
  });
});
