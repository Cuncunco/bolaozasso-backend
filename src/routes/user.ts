import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.code(404).send({ message: "Usuário não encontrado" });
    }

    return reply.send({ user });
  });

  fastify.put(
    "/users/profile",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = (request as any).userId as string;

      const bodySchema = z.object({
        name: z.string().min(2),
        avatarUrl: z.string().nullable().optional(),
      });

      const { name, avatarUrl } = bodySchema.parse(request.body);

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          avatarUrl: avatarUrl ?? null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      });

      return reply.send({ user });
    }
  );
}