import {
  isWebSocketCloseEvent,
  WebSocket,
} from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std@0.83.0/uuid/mod.ts";

let sockets = new Map<string, WebSocket>();
let mssg = { number: 0 };
let press_count: number = 0;
const wsManager = async (ws: WebSocket) => {
  const uid = v4.generate();

  if (!sockets.has(uid)) {
    ws.send(JSON.stringify({ number: press_count }));
  }
  sockets.set(uid, ws);

  for await (const ev of ws) {
    if (typeof ev === "string") {
      console.log(press_count);
      if (ev === "Increase") {
        press_count++;
      }
      mssg = {
        number: press_count,
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
