import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import path from "path";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { poolRoutes } from "./routes/pool.js";
import { userRoutes } from "./routes/user.js";
import { guessRoutes } from "./routes/guess.js";
import { gameRoutes } from "./routes/game.js";
import { authRoutes } from "./routes/auth.js";
import { rankingRoutes } from "./routes/ranking.js";
async function bootstrap() {
    const fastify = Fastify({ logger: true });
    await fastify.register(cors, {
        origin: true,
    });
    await fastify.register(multipart, {
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    });
    await fastify.register(fastifyStatic, {
        root: path.resolve("uploads"),
        prefix: "/uploads/",
    });
    await fastify.register(rankingRoutes);
    await fastify.register(poolRoutes);
    await fastify.register(authRoutes);
    await fastify.register(gameRoutes);
    await fastify.register(guessRoutes);
    await fastify.register(userRoutes);
    const port = Number(process.env.PORT) || 3333;
    fastify.get("/healthz", async () => ({ ok: true }));
    await fastify.listen({
        port,
        host: "0.0.0.0",
    });
}
bootstrap();
//# sourceMappingURL=server.js.map