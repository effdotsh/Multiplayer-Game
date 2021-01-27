import { serve } from "https://deno.land/std@0.83.0/http/server.ts";

//allows for websocket
import {
  acceptable,
  acceptWebSocket,
} from "https://deno.land/std@0.83.0/ws/mod.ts";

//Middleware to serve files
import { Application } from "https://deno.land/x/abc@v1.2.4/mod.ts";
const app = new Application();

//custom file handle all websocket reqs
import { wsManager } from "./wsManager.ts";

import "https://deno.land/x/dotenv/load.ts";

//Get port from env vars
// @ts-ignore
let fire_rate: string = +Deno.env.get("FIRE_RATE") || "200";
//@ts-ignore
const PORT: number = +Deno.env.get("PORT") || 8080;
const server = serve({ port: PORT });
const socket_url = Deno.env.get("SOCKET_URL") || `ws://localhost:${PORT}/ws`;

const decoder = new TextDecoder("utf-8");
const index_html = await decoder.decode(
  await Deno.readFile("./public/index.html"),
)
  .replace("%SOCKET_URL%", socket_url)
  .replace("%FIRE_RATE%", fire_rate);
console.log(socket_url);
console.log(`http://localhost:${PORT}`);
for await (const req of server) {
  if (req.url === "/ws") {
    if (acceptable(req)) {
      acceptWebSocket({
        conn: req.conn,
        bufReader: req.r,
        bufWriter: req.w,
        headers: req.headers,
      }).then(wsManager);
    }
  } else if (!req.url.includes("..")) { //send all non-websocket requests to the public folder
    if (req.url === "/" || req.url === "/index") {
      req.respond({
        status: 200,
        body: index_html,
      });
    } else {
      req.respond({
        status: 200,
        body: await Deno.open(`./public${req.url}`),
      });
    }
  } else {
    req.respond({
      status: 401,
      body: "Forbidden",
    });
  }
}
