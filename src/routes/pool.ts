import { FastifyInstance } from "fastify"
import { prisma  } from "../lib/prisma.js"
import { z } from "zod/mini"
import ShortUniqueId from "short-unique-id"
   
   export async function poolRoutes(fastify: FastifyInstance) {
    
    fastify.get("/pools/count", async () => {
      const count = await prisma.pool.count()

      return { count }
    })

    fastify.post("/pools", async (request, reply) => {
    const createPoolBody = z.object({
      title: z.string(),
    })

    const {title } = createPoolBody.parse(request.body)

    const uid = new ShortUniqueId({ length: 6 });
    const code = uid.rnd().toUpperCase();


    await prisma.pool.create({
      data: {
        title,
        code,
      }
    })

    return reply.status(201).send({ code })
    })
   }
   
   