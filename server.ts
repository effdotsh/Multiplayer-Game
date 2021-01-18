import { serve } from "https://deno.land/std@0.83.0/http/server.ts";

import {
  acceptable,
  acceptWebSocket,
} from "https://deno.land/std@0.83.0/ws/mod.ts";

import { wsManager } from "./wsManager.ts";

import "https://deno.land/x/dotenv/load.ts";

//Get port from env vars
// @ts-ignore
const PORT: number = +Deno.env.get("PORT") || 8080;

const decoder = new TextDecoder("utf-8");
const server = serve({ port: PORT });

for await (const req of server) {
  //send user html form
  if (req.url === "/") {
    req.respond({
      status: 200,
      body: await Deno.open("./public/index.html"),
    });
  }

  //Establish websocket request
  if (req.url === "/ws") {
    if (acceptable(req)) {
      acceptWebSocket({
        conn: req.conn,
        bufReader: req.r,
        bufWriter: req.w,
        headers: req.headers,
      }).then(wsManager);
    }
  }
}
