import { serve, Server } from "https://deno.land/std/http/server.ts";
import { existsSync } from "https://deno.land/std/fs/mod.ts";
//allows for websocket
import { acceptable, acceptWebSocket } from "https://deno.land/std/ws/mod.ts";

//Middleware to serve files
import { Application } from "https://deno.land/x/abc@v1.2.4/mod.ts";
const app = new Application();

//custom file handle all websocket reqs
import { game_background, wsManager } from "./wsManager.ts";

import "https://deno.land/x/dotenv/load.ts";

//Get port from env vars
let fire_rate: string = Deno.env.get("FIRE_RATE") ?? "400";
const PORT: number = parseInt(Deno.env.get("PORT") ?? "8080");
const dash_cooldown: string = (Deno.env.get("DASH_COOLDOWN") ?? "1000");
const dash_time: string = Deno.env.get("DASH_TIME") ?? "150";
const bullet_speed: string = Deno.env.get("BULLET_SPEED") ?? "15";
const bullet_despawn: string = Deno.env.get("BULLET_DESPAWN") ?? "5000";
const movement_speed: string = Deno.env.get("PLAYER_SPEED") ?? "5";

const server = serve({ port: PORT });
const socket_url = Deno.env.get("SOCKET_URL") || `ws://localhost:${PORT}/ws`;

const decoder = new TextDecoder("utf-8");

const index_html = await decoder.decode(
  await Deno.readFile("./public/index.html"),
)
  .replace("%SOCKET_URL%", socket_url)
  .replace("%FIRE_RATE%", fire_rate)
  .replace("%DASH_COOLDOWN%", dash_cooldown)
  .replace("%DASH_TIME%", dash_time)
  .replace("%BULLET_DESPAWN%", bullet_despawn)
  .replace("%MOVE_SPEED%", movement_speed);

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
      let status: number;
      if (existsSync(`./public${req.url}`)) {
        let file = await Deno.open(`./public${req.url}`);
        status = 200;
        req.respond({
          status: status,
          body: file,
        });
      } else {
        status = 404;
        req.respond({
          status: status,
          body: "file not found",
        });
      }
    }
  } else {
    req.respond({
      status: 401,
      body: "Forbidden",
    });
  }
}

// while (true) {
//   const bob = async (ree: Server) => {
//     console.log(ree);
//     for await (const req of server) {
//       if (req.url === "/ws") {
//         if (acceptable(req)) {
//           acceptWebSocket({
//             conn: req.conn,
//             bufReader: req.r,
//             bufWriter: req.w,
//             headers: req.headers,
//           }).then(wsManager);
//         }
//       } else if (!req.url.includes("..")) { //send all non-websocket requests to the public folder
//         if (req.url === "/" || req.url === "/index") {
//           req.respond({
//             status: 200,
//             body: index_html,
//           });
//         } else {
//           let status: number;
//           if (existsSync(`./public${req.url}`)) {
//             let file = await Deno.open(`./public${req.url}`);
//             status = 200;
//             req.respond({
//               status: status,
//               body: file,
//             });
//           } else {
//             status = 404;
//             req.respond({
//               status: status,
//               body: "file not found",
//             });
//           }
//         }
//       } else {
//         req.respond({
//           status: 401,
//           body: "Forbidden",
//         });
//       }
//     }
//   };
//   bob(server);

//   // game_background();
// }
