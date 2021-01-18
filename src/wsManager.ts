import {
  isWebSocketCloseEvent,
  WebSocket,
} from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std@0.83.0/uuid/mod.ts";

let sockets = new Map<string, WebSocket>();
let mssg = { presses: 0, connections: 1 };
let press_count: number = 0;

const wsManager = async (ws: WebSocket) => {
  const uid = v4.generate();

  if (!sockets.has(uid)) {
    sockets.set(uid, ws);

    mssg = {
      presses: press_count,
      connections: sockets.size,
    };
    sockets.forEach((ws: WebSocket) => {
      ws.send(JSON.stringify(mssg));
    });
  }

  for await (const ev of ws) {
    if (typeof ev === "string") {
      if (ev === "up") {
        press_count++;
      } else if (ev === "down") {
        press_count--;
      }

      mssg = {
        presses: press_count,
        connections: sockets.size,
      };
      sockets.forEach((ws: WebSocket) => {
        ws.send(JSON.stringify(mssg));
      });
    }

    //delete socket if connection closed
    if (isWebSocketCloseEvent(ev)) {
      sockets.delete(uid);
    }
  }
};

export { wsManager };
