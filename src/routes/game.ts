import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";

export async function gameRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/pools/:poolId/results",
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

      const pool = await prisma.pool.findUnique({
        where: { id: poolId },
        select: { ownerId: true },
      });

      if (!pool) {
        return reply.code(404).send({ message: "Bolão não encontrado." });
      }

      const isOwner = pool.ownerId === userId;

      if (!participant && !isOwner) {
        return reply
          .code(403)
          .send({ message: "Você não tem acesso a este bolão." });
      }

      const results = await prisma.gameResult.findMany({
        where: { poolId },
      });

      return reply.send({ results });
    }
  );

  fastify.put(
    "/pools/:poolId/games/:gameId/result",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = (request as any).userId as string;

      const paramsSchema = z.object({
        poolId: z.string(),
        gameId: z.string(),
      });

      const bodySchema = z.object({
        firstTeamPoints: z.number(),
        secondTeamPoints: z.number(),
      });

      const { poolId, gameId } = paramsSchema.parse(request.params);
      const { firstTeamPoints, secondTeamPoints } = bodySchema.parse(
        request.body
      );

      const pool = await prisma.pool.findUnique({
        where: { id: poolId },
      });

      if (!pool) {
        return reply.code(404).send({ message: "Bolão não encontrado." });
      }

      if (pool.ownerId !== userId) {
        return reply
          .code(403)
          .send({ message: "Apenas o dono pode definir o resultado." });
      }

      const result = await prisma.gameResult.upsert({
        where: {
          poolId_gameId: {
            poolId,
            gameId,
          },
        },
        update: {
          firstTeamPoints,
          secondTeamPoints,
        },
        create: {
          poolId,
          gameId,
          firstTeamPoints,
          secondTeamPoints,
        },
      });

      return reply.send({ result });
    }
  );

  fastify.delete(
    "/pools/:poolId/games/:gameId/result",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = (request as any).userId as string;

      const paramsSchema = z.object({
        poolId: z.string(),
        gameId: z.string(),
      });

      const { poolId, gameId } = paramsSchema.parse(request.params);

      const pool = await prisma.pool.findUnique({
        where: { id: poolId },
      });

      if (!pool) {
        return reply.code(404).send({ message: "Bolão não encontrado." });
      }

      if (pool.ownerId !== userId) {
        return reply
          .code(403)
          .send({ message: "Apenas o dono pode reabrir o jogo." });
      }

      await prisma.gameResult.deleteMany({
        where: {
          poolId,
          gameId,
        },
      });

      return reply.send({ message: "Jogo reaberto com sucesso." });
    }
  );
}