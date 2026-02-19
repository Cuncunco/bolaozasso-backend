import "dotenv/config"
import Fastify from "fastify"
import cors from '@fastify/cors'
import { prisma } from "./lib/prisma.js"
import { z } from 'zod'
import ShortUniqueId from "short-unique-id"
import { poolRoutes } from "./routes/pool.js"
import { userRoutes } from "./routes/user.js"
import { guessRoutes } from "./routes/guess.js"
import { gameRoutes } from "./routes/game.js"
import { authRoutes } from "./routes/auth.js"



async function bootstrap() {
  const fastify = Fastify({ logger: true })

  await fastify.register(cors, {
    origin: true,
  })

await fastify.register(poolRoutes)
await fastify.register(authRoutes)
await fastify.register(gameRoutes)
await fastify.register(guessRoutes)
await fastify.register(userRoutes)

    

  await fastify.listen({ port: 3333, host: '0.0.0.0'})
}

bootstrap()
