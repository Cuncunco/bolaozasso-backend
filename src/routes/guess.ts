import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";

export async function guessRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/pools/:poolId/games/:gameId/guesses",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      console.log("=== ROTA NOVA DE GUESS EXECUTANDO ===");

      const paramsSchema = z.object({
        poolId: z.string(),
        gameId: z.string(),
      });

      const bodySchema = z.object({
        firstTeamPoints: z.number().int().min(0),
        secondTeamPoints: z.number().int().min(0),
      });

      const { poolId, gameId } = paramsSchema.parse(request.params);
      const { firstTeamPoints, secondTeamPoints } = bodySchema.parse(
        request.body
      );

      const userId = (request as any).userId as string;

      const resultExists = await prisma.gameResult.findUnique({
        where: {
          poolId_gameId: {
            poolId,
            gameId,
          },
        },
      });

      if (resultExists) {
        return reply.code(409).send({
          message: "Palpites encerrados: o resultado já foi definido.",
        });
      }

      const participant = await prisma.participant.findUnique({
        where: {
          userId_poolId: {
            userId,
            poolId,
          },
        },
      });

      if (!participant) {
        return reply.status(404).send({
          message: "Você não participa desse bolão.",
        });
      }

      const guess = await prisma.guess.upsert({
        where: {
          poolId_gameId_userId: {
            poolId,
            gameId,
            userId,
          },
        },
        update: {
          firstTeamPoints,
          secondTeamPoints,
        },
        create: {
          poolId,
          gameId,
          userId,
          firstTeamPoints,
          secondTeamPoints,
        },
      });

      return reply.status(201).send({
        message: "Palpite salvo com sucesso.",
        guess,
      });
    }
  );

  fastify.get(
    "/pools/:poolId/guesses",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const paramsSchema = z.object({
        poolId: z.string(),
      });

      const { poolId } = paramsSchema.parse(request.params);
      const userId = (request as any).userId as string;

      const participant = await prisma.participant.findUnique({
        where: {
          userId_poolId: {
            userId,
            poolId,
          },
        },
      });

      if (!participant) {
        return reply.status(404).send({
          message: "Você não participa desse bolão.",
        });
      }

      const guesses = await prisma.guess.findMany({
        where: {
          poolId,
          userId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return reply.send({ guesses });
    }
  );
}