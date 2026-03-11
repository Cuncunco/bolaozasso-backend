import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import ShortUniqueId from "short-unique-id";
import { requireAuth } from "../middlewares/requireAuth";

export async function poolRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/pools/count",
    { preHandler: [requireAuth] },
    async (request) => {
      const userId = (request as any).userId as string;

      const count = await prisma.pool.count({
        where: {
          participants: {
            some: { userId },
          },
        },
      });

      return { count };
    }
  );

  fastify.get(
    "/pools",
    { preHandler: [requireAuth] },
    async (request) => {
      const userId = (request as any).userId as string;

      const pools = await prisma.pool.findMany({
        where: {
          participants: {
            some: { userId },
          },
        },
        select: {
          id: true,
          title: true,
          code: true,
          createdAt: true,
          ownerId: true,
          owner: {
            select: { name: true },
          },
          participants: {
            select: {
              id: true,
              user: { select: { avatarUrl: true } },
            },
            take: 4,
          },
          _count: {
            select: { participants: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return { pools };
    }
  );

  fastify.post(
    "/pools",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const createPoolBody = z.object({
        title: z.string(),
      });

      const { title } = createPoolBody.parse(request.body);

      const uid = new ShortUniqueId({ length: 6 });
      const code = uid.rnd().toUpperCase();

      const userId = (request as any).userId as string;

      const pool = await prisma.pool.create({
        data: {
          title,
          code,
          ownerId: userId,
          participants: {
            create: {
              userId,
            },
          },
        },
        select: {
          code: true,
        },
      });

      return reply.status(201).send(pool);
    }
  );

  fastify.post(
    "/pools/join",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const joinPoolBody = z.object({
        code: z.string(),
      });

      const { code } = joinPoolBody.parse(request.body);

      const pool = await prisma.pool.findUnique({
        where: { code: code.trim().toUpperCase() },
        select: { id: true },
      });

      if (!pool) {
        return reply.code(404).send({ message: "Pool not found." });
      }

      const userId = (request as any).userId as string;

      const participantExists = await prisma.participant.findUnique({
        where: {
          userId_poolId: {
            userId,
            poolId: pool.id,
          },
        },
      });

      if (participantExists) {
        return reply
          .code(409)
          .send({ message: "You already joined this pool." });
      }

      await prisma.participant.create({
        data: {
          userId,
          poolId: pool.id,
        },
      });

      return reply.code(201).send();
    }
  );

  fastify.get(
    "/pools/:poolId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const getPoolParams = z.object({
        poolId: z.string(),
      });

      const { poolId } = getPoolParams.parse(request.params);
      const userId = (request as any).userId as string;

      const pool = await prisma.pool.findFirst({
        where: {
          id: poolId,
          participants: {
            some: {
              userId,
            },
          },
        },
        select: {
          id: true,
          title: true,
          code: true,
          createdAt: true,
          ownerId: true,
          owner: {
            select: { name: true },
          },
          participants: {
            select: {
              id: true,
              user: { select: { avatarUrl: true } },
            },
            take: 4,
          },
          _count: {
            select: { participants: true },
          },
        },
      });

      if (!pool) {
        return reply.code(404).send({ message: "Pool not found." });
      }

      return reply.send({ pool });
    }
  );

  fastify.post(
    "/pools/:poolId/results",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const paramsSchema = z.object({
        poolId: z.string(),
      });

      const bodySchema = z.object({
        gameId: z.string(),
        firstTeamPoints: z.number().int().min(0),
        secondTeamPoints: z.number().int().min(0),
      });

      const { poolId } = paramsSchema.parse(request.params);
      const { gameId, firstTeamPoints, secondTeamPoints } = bodySchema.parse(
        request.body
      );

      const userId = (request as any).userId as string;

      const pool = await prisma.pool.findUnique({
        where: { id: poolId },
        select: { id: true, ownerId: true },
      });

      if (!pool) {
        return reply.code(404).send({ message: "Pool not found." });
      }

      if (pool.ownerId !== userId) {
        return reply
          .code(403)
          .send({ message: "Only the owner can set the official result." });
      }

      await prisma.gameResult.upsert({
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

      return reply.code(201).send({
        message: "Official result saved successfully.",
      });
    }
  );

  fastify.delete(
    "/pools/:poolId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const paramsSchema = z.object({ poolId: z.string() });
      const { poolId } = paramsSchema.parse(request.params);

      const userId = (request as any).userId as string;

      const pool = await prisma.pool.findUnique({
        where: { id: poolId },
        select: { id: true, ownerId: true },
      });

      if (!pool) {
        return reply.code(404).send({ message: "Pool not found." });
      }

      if (pool.ownerId !== userId) {
        return reply
          .code(403)
          .send({ message: "Only the owner can delete this pool." });
      }

      await prisma.$transaction(async (tx) => {
        await tx.guess.deleteMany({
          where: {
            poolId,
          },
        });

        await tx.participant.deleteMany({
          where: { poolId },
        });

        await tx.gameResult.deleteMany({
          where: { poolId },
        });

        await tx.pool.delete({
          where: { id: poolId },
        });
      });

      return reply.code(204).send();
    }
  );
}