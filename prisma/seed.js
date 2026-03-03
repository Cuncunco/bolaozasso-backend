import { prisma } from "../src/lib/prisma.js";
import bcrypt from "bcryptjs";
async function main() {
    // =========================
    // USER SEED
    // =========================
    const email = "johndoe@gmail.com";
    const plainPassword = "123456";
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            name: "John Doe",
            passwordHash,
            avatarUrl: "https://github.com/diego3g.png",
        },
        create: {
            name: "John Doe",
            email,
            avatarUrl: "https://github.com/diego3g.png",
            passwordHash,
        },
        select: { id: true, name: true, email: true },
    });
    console.log("✅ Seed user:", user);
    // (Opcional) criar 1 pool + participant pra você já testar palpites
    const pool = await prisma.pool.upsert({
        where: { code: "BOLAO-TESTE" },
        update: { title: "Bolão Teste" },
        create: {
            title: "Bolão Teste",
            code: "BOLAO-TESTE",
            ownerId: user.id,
        },
        select: { id: true, title: true, code: true },
    });
    console.log("✅ Seed pool:", pool);
    await prisma.participant.upsert({
        where: {
            userId_poolId: { userId: user.id, poolId: pool.id },
        },
        update: {},
        create: {
            userId: user.id,
            poolId: pool.id,
        },
        select: { id: true, userId: true, poolId: true },
    });
    console.log("✅ Seed participant ok");
}
main()
    .then(async () => prisma.$disconnect())
    .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map