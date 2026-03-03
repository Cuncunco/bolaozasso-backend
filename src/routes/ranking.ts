import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";

function pointsForGuess(
  g1: number,
  g2: number,
  r1: number,
  r2: number
): number {
  // 3 pontos: placar exato
  if (g1 === r1 && g2 === r2) return 3;

  // 1 ponto: acertou vencedor/empate
  const guessDiff = g1 - g2;
  const realDiff = r1 - r2;

  const guessOutcome =
    guessDiff === 0 ? "draw" : guessDiff > 0 ? "home" : "away";

  const realOutcome =
    realDiff === 0 ? "draw" : realDiff > 0 ? "home" : "away";

  return guessOutcome === realOutcome ? 1 : 0;
}

export async function rankingRoutes(fastify: FastifyInstance) {

  // 🔥 Definir resultado oficial
  fastify.put(
    "/pools/:poolId/games/:gameId/result",
    { preHandler: [requireAuth] },
    async (request, reply) => {

      const paramsSchema = z.object({
        poolId: z.string(),
        gameId: z.string(),
      });

      const bodySchema = z.object({
        firstTeamPoints: z.number().int().nonnegative(),
        secondTeamPoints: z.number().int().nonnegative(),
      });

      const { poolId, gameId } = paramsSchema.parse(request.params);
      const { firstTeamPoints, secondTeamPoints } = bodySchema.parse(request.body);

      const userId = (request as any).userId as string;

      // 🔒 Verifica se é dono do bolão
      const pool = await prisma.pool.findUnique({
        where: { id: poolId },
        select: { ownerId: true },
      });

      if (!pool) {
        return reply.code(404).send({ message: "Pool not found." });
      }

      if (pool.ownerId !== userId) {
        return reply
          .code(403)
          .send({ message: "Apenas o admin pode definir o resultado." });
      }

      const result = await prisma.gameResult.upsert({
        where: { gameId },
        update: {
          firstTeamPoints,
          secondTeamPoints,
        },
        create: {
          gameId,
          firstTeamPoints,
          secondTeamPoints,
        },
      });

      return reply.send({ result });
    }
  );

  // 🔓 Reabrir palpites (deletar resultado)
  fastify.delete(
    "/pools/:poolId/games/:gameId/result",
    { preHandler: [requireAuth] },
    async (request, reply) => {

      const paramsSchema = z.object({
        poolId: z.string(),
        gameId: z.string(),
      });

      const { poolId, gameId } = paramsSchema.parse(request.params);
      const userId = (request as any).userId as string;

      const pool = await prisma.pool.findUnique({
        where: { id: poolId },
        select: { ownerId: true },
      });

      if (!pool) {
        return reply.code(404).send({ message: "Pool not found." });
      }

      if (pool.ownerId !== userId) {
        return reply
          .code(403)
          .send({ message: "Apenas o admin pode reabrir o jogo." });
      }

      await prisma.gameResult.delete({
        where: { gameId },
      });

      return reply.code(204).send();
    }
  );

  // 📊 Ranking
  fastify.get("/pools/:poolId/ranking", async (request, reply) => {

    const paramsSchema = z.object({ poolId: z.string() });
    const { poolId } = paramsSchema.parse(request.params);

    const participants = await prisma.participant.findMany({
      where: { poolId },
      select: {
        id: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const guesses = await prisma.guess.findMany({
      where: { participant: { poolId } },
    });

    const gameIds = Array.from(new Set(guesses.map(g => g.gameId)));

    const results = await prisma.gameResult.findMany({
      where: { gameId: { in: gameIds } },
    });

    const resultByGameId = new Map(results.map(r => [r.gameId, r]));

    const scoreByParticipant = new Map<string, number>();

    for (const p of participants) {
      scoreByParticipant.set(p.id, 0);
    }

    for (const g of guesses) {
      const result = resultByGameId.get(g.gameId);
      if (!result) continue;

      const current = scoreByParticipant.get(g.participantId) ?? 0;

      scoreByParticipant.set(
        g.participantId,
        current +
          pointsForGuess(
            g.firstTeamPoints,
            g.secondTeamPoints,
            result.firstTeamPoints,
            result.secondTeamPoints
          )
      );
    }

    const ranking = participants
      .map(p => ({
        participantId: p.id,
        user: p.user,
        points: scoreByParticipant.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points)
      .map((row, idx) => ({
        position: idx + 1,
        ...row,
      }));

    return reply.send({ ranking });
  });
}