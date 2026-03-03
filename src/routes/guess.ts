import { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { z } from "zod"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!
if (!JWT_SECRET) throw new Error("JWT_SECRET not set");

export async function guessRoutes(fastify: FastifyInstance) {

  fastify.get("/guesses/count", async () => {
    const count = await prisma.guess.count()
    return { count }
  })

  fastify.post("/pools/:poolId/games/:gameId/guesses", async (request, reply) => {

    const paramsSchema = z.object({
      poolId: z.string(),
      gameId: z.string(),
    })

    const bodySchema = z.object({
      firstTeamPoints: z.number(),
      secondTeamPoints: z.number(),
    })

    const { poolId, gameId } = paramsSchema.parse(request.params)
    const { firstTeamPoints, secondTeamPoints } = bodySchema.parse(request.body)

    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ message: "Token não informado" })
    }

    const token = authHeader.split(" ")[1]

    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch {
      return reply.status(401).send({ message: "Token inválido" })
    }

    const userId = decoded.sub as string

        const resultExists = await prisma.gameResult.findUnique({
      where: { gameId },
      select: { id: true },
    });

    if (resultExists) {
      return reply
        .code(409)
        .send({ message: "Palpites encerrados: o resultado já foi definido." });
    }

    // Buscar participante
    const participant = await prisma.participant.findUnique({
      where: {
        userId_poolId: { userId, poolId },
      },
    })

    if (!participant) {
      return reply.status(404).send({ message: "Você não participa desse bolão." })
    }

    const guess = await prisma.guess.upsert({
  where: {
    participantId_gameId: {
      participantId: participant.id,
      gameId,
    },
  },
  update: {
    firstTeamPoints,
    secondTeamPoints,
  },
  create: {
    firstTeamPoints,
    secondTeamPoints,
    gameId,
    participantId: participant.id,
  },
});

    return reply.status(201).send(guess)
  })
}