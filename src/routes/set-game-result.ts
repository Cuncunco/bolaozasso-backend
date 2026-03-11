import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../plugins/authenticate";

export async function setGameResult(app: FastifyInstance) {
  app.post(
    "/pools/:id/results",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({
        id: z.string().cuid(),
      });

      const bodySchema = z.object({
        gameId: z.string().min(1),
        firstTeamPoints: z.number().int().min(0),
        secondTeamPoints: z.number().int().min(0),
      });

      const { id: poolId } = paramsSchema.parse(request.params);
      const { gameId, firstTeamPoints, secondTeamPoints } = bodySchema.parse(
        request.body
      );

      const userId = request.user.sub;

      const pool = await prisma.pool.findUnique({
        where: {
          id: poolId,
        },
      });

      if (!pool) {
        return reply.status(404).send({
          message: "Bolão não encontrado.",
        });
      }

      if (pool.ownerId !== userId) {
        return reply.status(403).send({
          message: "Apenas o dono do bolão pode definir o resultado oficial.",
        });
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

      return reply.status(201).send({
        message: "Placar oficial definido com sucesso.",
        result,
      });
    }
  );
}