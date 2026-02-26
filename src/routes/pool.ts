import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import ShortUniqueId from "short-unique-id";
import { requireAuth } from "../middlewares/requireAuth.js";

export async function poolRoutes(fastify: FastifyInstance) {
  // ===============================
  // GET /pools/count
  // ===============================
  fastify.get("/pools/count", async () => {
    const count = await prisma.pool.count();
    return { count };
  });

  // ===============================
  // GET /pools
  // ===============================
  fastify.get("/pools", async () => {
    const pools = await prisma.pool.findMany({
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
  });

  // ===============================
  // POST /pools  (criar bolão)
  // ===============================
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

    await prisma.pool.create({
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
    });

    return reply.status(201).send({ code });
  }
);

  // ===============================
  // POST /pools/join
  // ===============================
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
        return reply.code(409).send({ message: "You already joined this pool." });
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
}