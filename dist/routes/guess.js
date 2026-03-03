import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
export async function guessRoutes(fastify) {
    fastify.get("/guesses/count", async () => {
        const count = await prisma.guess.count();
        return { count };
    });
    fastify.post("/pools/:poolId/games/:gameId/guesses", { preHandler: [requireAuth] }, async (request, reply) => {
        const paramsSchema = z.object({
            poolId: z.string(),
            gameId: z.string(),
        });
        const bodySchema = z.object({
            firstTeamPoints: z.number(),
            secondTeamPoints: z.number(),
        });
        const { poolId, gameId } = paramsSchema.parse(request.params);
        const { firstTeamPoints, secondTeamPoints } = bodySchema.parse(request.body);
        const userId = request.userId;
        // 🔒 Verifica se já existe resultado oficial
        const resultExists = await prisma.gameResult.findUnique({
            where: { gameId },
        });
        if (resultExists) {
            return reply
                .code(409)
                .send({ message: "Palpites encerrados: o resultado já foi definido." });
        }
        // 🔎 Buscar participante
        const participant = await prisma.participant.findUnique({
            where: {
                userId_poolId: { userId, poolId },
            },
        });
        if (!participant) {
            return reply
                .status(404)
                .send({ message: "Você não participa desse bolão." });
        }
        // 🔁 Cria ou atualiza palpite
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
        return reply.status(201).send(guess);
    });
}
//# sourceMappingURL=guess.js.map