import { WebSocket } from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std@0.83.0/uuid/mod.ts";

let sockets = new Map<string, WebSocket>();

const wsManager = async (ws: WebSocket) => {
  const uid = v4.generate();
  sockets.set(uid, ws);
  console.log(sockets.size);
  let mssg = {
    number: sockets.size,
  };
  sockets.forEach((ws: WebSocket) => {
    ws.send(JSON.stringify(mssg));
  });
};

export { wsManager };
