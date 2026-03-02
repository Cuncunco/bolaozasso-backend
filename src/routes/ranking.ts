import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET not set");

function getUserIdFromAuthHeader(authHeader?: string) {
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded.sub as string;
  } catch {
    return null;
  }
}

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

  const guessOutcome = guessDiff === 0 ? "draw" : guessDiff > 0 ? "home" : "away";
  const realOutcome = realDiff === 0 ? "draw" : realDiff > 0 ? "home" : "away";

  return guessOutcome === realOutcome ? 1 : 0;
}

export async function rankingRoutes(fastify: FastifyInstance) {
  // ✅ endpoint pra cadastrar/atualizar resultado oficial de um jogo
  fastify.put("/games/:gameId/result", async (request, reply) => {
    const userId = getUserIdFromAuthHeader(request.headers.authorization);
    if (!userId) return reply.status(401).send({ message: "Token inválido/ausente" });

    const paramsSchema = z.object({ gameId: z.string() });
    const bodySchema = z.object({
      firstTeamPoints: z.number().int().nonnegative(),
      secondTeamPoints: z.number().int().nonnegative(),
    });

    const { gameId } = paramsSchema.parse(request.params);
    const { firstTeamPoints, secondTeamPoints } = bodySchema.parse(request.body);

    const result = await prisma.gameResult.upsert({
      where: { gameId },
      update: { firstTeamPoints, secondTeamPoints },
      create: { gameId, firstTeamPoints, secondTeamPoints },
    });

    return reply.status(200).send({ result });
  });

  // ✅ ranking com pontuação
  fastify.get("/pools/:poolId/ranking", async (request, reply) => {
    const paramsSchema = z.object({ poolId: z.string() });
    const { poolId } = paramsSchema.parse(request.params);

    // participantes do bolão
    const participants = await prisma.participant.findMany({
      where: { poolId },
      select: {
        id: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // todos os palpites do bolão
    const guesses = await prisma.guess.findMany({
      where: { participant: { poolId } },
      select: {
        participantId: true,
        gameId: true,
        firstTeamPoints: true,
        secondTeamPoints: true,
      },
    });

    // resultados oficiais (pelos gameIds usados)
    const gameIds = Array.from(new Set(guesses.map((g) => g.gameId)));
    const results = await prisma.gameResult.findMany({
      where: { gameId: { in: gameIds } },
      select: { gameId: true, firstTeamPoints: true, secondTeamPoints: true },
    });

    const resultByGameId = new Map(results.map((r) => [r.gameId, r]));

    // soma pontos por participante
    const scoreByParticipant = new Map<string, { points: number; guesses: number; scoredGuesses: number }>();
    for (const p of participants) {
      scoreByParticipant.set(p.id, { points: 0, guesses: 0, scoredGuesses: 0 });
    }

    for (const g of guesses) {
      const acc = scoreByParticipant.get(g.participantId);
      if (!acc) continue;

      acc.guesses += 1;

      const r = resultByGameId.get(g.gameId);
      if (!r) continue; // ainda sem resultado oficial

      acc.points += pointsForGuess(
        g.firstTeamPoints,
        g.secondTeamPoints,
        r.firstTeamPoints,
        r.secondTeamPoints
      );
      acc.scoredGuesses += 1;
    }

    const ranking = participants
      .map((p) => {
        const acc = scoreByParticipant.get(p.id)!;
        return {
          participantId: p.id,
          user: p.user,
          points: acc.points,
          guessesCount: acc.guesses,
          scoredGuessesCount: acc.scoredGuesses,
        };
      })
      .sort((a, b) => {
        // 1) pontos desc
        if (b.points !== a.points) return b.points - a.points;
        // 2) mais palpites com resultado (desempate)
        if (b.scoredGuessesCount !== a.scoredGuessesCount) return b.scoredGuessesCount - a.scoredGuessesCount;
        // 3) mais palpites enviados
        return b.guessesCount - a.guessesCount;
      })
      .map((row, idx) => ({ position: idx + 1, ...row }));

    return reply.send({ ranking });
  });
}