import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";

function pointsForGuess(
  g1: number,
  g2: number,
  r1: number,
  r2: number
): number {
  if (g1 === r1 && g2 === r2) return 3;

  const guessDiff = g1 - g2;
  const realDiff = r1 - r2;

  const guessOutcome =
    guessDiff === 0 ? "draw" : guessDiff > 0 ? "home" : "away";

  const realOutcome =
    realDiff === 0 ? "draw" : realDiff > 0 ? "home" : "away";

  return guessOutcome === realOutcome ? 1 : 0;
}

export async function rankingRoutes(fastify: FastifyInstance) {
  fastify.get("/pools/:poolId/ranking", async (request, reply) => {
    const paramsSchema = z.object({
      poolId: z.string(),
    });

    const { poolId } = paramsSchema.parse(request.params);

    const participants = await prisma.participant.findMany({
      where: { poolId },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const guesses = await prisma.guess.findMany({
      where: { poolId },
    });

    const gameIds = Array.from(new Set(guesses.map((g) => g.gameId)));

    const results = await prisma.gameResult.findMany({
      where: {
        poolId,
        gameId: { in: gameIds },
      },
    });

    const resultByGameId = new Map(results.map((r) => [r.gameId, r]));
    const scoreByUserId = new Map<string, number>();

    for (const p of participants) {
      scoreByUserId.set(p.userId, 0);
    }

    for (const g of guesses) {
      const result = resultByGameId.get(g.gameId);
      if (!result) continue;

      const current = scoreByUserId.get(g.userId) ?? 0;

      scoreByUserId.set(
        g.userId,
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
      .map((p) => ({
        userId: p.userId,
        user: p.user,
        points: scoreByUserId.get(p.userId) ?? 0,
      }))
      .sort((a, b) => b.points - a.points)
      .map((row, idx) => ({
        position: idx + 1,
        ...row,
      }));

    return reply.send({ ranking });
  });
}