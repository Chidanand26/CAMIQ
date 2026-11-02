import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import os from "node:os";
import type { IncomingMessage, ServerResponse } from "node:http";

type SyncEnvelope = {
  id: string;
  room: string;
  type: string;
  senderId: string;
  timestamp: number;
  payload: unknown;
};

function getLocalLanIps(): string[] {
  const nets = os.networkInterfaces();
  const results: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

function camiqRealtimeSyncPlugin(): Plugin {
  const events: SyncEnvelope[] = [];
  const sseClients = new Set<ServerResponse>();

  const setCors = (res: ServerResponse) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  };

  return {
    name: "camiq-realtime-sync-server",
    configureServer(server) {
      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const url = req.url ?? "";
          if (!url.startsWith("/api/camiq")) {
            return next();
          }

          setCors(res);
          if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (url.startsWith("/api/camiq/info") && req.method === "GET") {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: true,
                lanIps: getLocalLanIps(),
                port: 3000,
                eventCount: events.length,
              }),
            );
            return;
          }

          if (url.startsWith("/api/camiq/events") && req.method === "GET") {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, events: events.slice(-100) }));
            return;
          }

          if (url.startsWith("/api/camiq/stream") && req.method === "GET") {
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
              "Access-Control-Allow-Origin": "*",
            });
            res.write(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`);
            sseClients.add(res);
            req.on("close", () => {
              sseClients.delete(res);
            });
            return;
          }

          if (url.startsWith("/api/camiq/event") && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", () => {
              try {
                const parsed = JSON.parse(body) as SyncEnvelope;
                if (parsed && parsed.id && !events.some((e) => e.id === parsed.id)) {
                  events.push(parsed);
                  if (events.length > 200) events.shift();
                  const msg = `data: ${JSON.stringify(parsed)}\n\n`;
                  sseClients.forEach((client) => {
                    try {
                      client.write(msg);
                    } catch {
                      sseClients.delete(client);
                    }
                  });
                }
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
              } catch (e) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: e instanceof Error ? e.message : "Invalid JSON",
                  }),
                );
              }
            });
            return;
          }

          next();
        },
      );
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [react(), tailwindcss(), camiqRealtimeSyncPlugin()],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
