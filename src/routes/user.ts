import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { z } from "zod";
import { hash } from "bcryptjs";

export async function userRoutes(fastify: FastifyInstance) {
  fastify.post("/users", async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email(),
      password: z.string().min(6),
    });

    const { name, email, password } = bodySchema.parse(request.body);

    const userAlreadyExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userAlreadyExists) {
      return reply.code(409).send({ message: "E-mail já cadastrado." });
    }

    const passwordHash = await hash(password, 6);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    return reply.code(201).send({ user });
  });

  fastify.get("/users/count", async () => {
    const count = await prisma.user.count();
    return { count };
  });

  fastify.get("/me", { preHandler: [requireAuth] }, async (request) => {
    const userId = (request as any).userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    return { user };
  });

  fastify.put("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;

    const bodySchema = z.object({
      name: z.string().min(2).optional(),
    });

    const { name } = bodySchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { ...(name !== undefined ? { name } : {}) },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    return reply.send({ user });
  });

  fastify.post(
    "/me/avatar",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = (request as any).userId as string;

      const file = await request.file();

      if (!file) {
        return reply.code(400).send({ message: "Envie um arquivo 'avatar'." });
      }

      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.mimetype)) {
        return reply
          .code(400)
          .send({ message: "Formato inválido. Use JPG, PNG ou WEBP." });
      }

      const uploadDir = path.resolve("uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const ext =
        file.mimetype === "image/png"
          ? "png"
          : file.mimetype === "image/webp"
          ? "webp"
          : "jpg";

      const filename = `${userId}-${crypto.randomUUID()}.${ext}`;
      const filepath = path.join(uploadDir, filename);

      await pumpToFile(file.file, filepath);

      const host = request.headers["x-forwarded-host"] || request.headers.host;
      const protocol = request.headers["x-forwarded-proto"] || "http";

      const avatarUrl = `${protocol}://${host}/uploads/${filename}`;

      const user = await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl },
        select: { id: true, name: true, email: true, avatarUrl: true },
      });

      return reply.send({ user });
    }
  );
}

function pumpToFile(stream: NodeJS.ReadableStream, filepath: string) {
  return new Promise<void>((resolve, reject) => {
    const write = fs.createWriteStream(filepath);
    stream.pipe(write);
    stream.on("error", reject);
    write.on("finish", () => resolve());
    write.on("error", reject);
  });
}