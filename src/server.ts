import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import path from "path";

import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/user.js";
import { poolRoutes } from "./routes/pool.js";
import { guessRoutes } from "./routes/guess.js";
import { rankingRoutes } from "./routes/ranking.js";
import { gameRoutes } from "./routes/game.js";

const fastify = Fastify({ logger: true });

async function bootstrap() {
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(multipart);

  await fastify.register(staticPlugin, {
    root: path.resolve("uploads"),
    prefix: "/uploads/",
  });

  fastify.get("/health", async () => ({ ok: true }));

  await fastify.register(authRoutes);
  await fastify.register(userRoutes);
  await fastify.register(poolRoutes);
  await fastify.register(guessRoutes);
  await fastify.register(rankingRoutes);
  await fastify.register(gameRoutes);

  const port = Number(process.env.PORT ?? 3333);

  await fastify.listen({
    port,
    host: "0.0.0.0",
  });

  fastify.log.info(`Server running on port ${port}`);
}

bootstrap().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});