import { FastifyInstance } from "fastify";
import { createWriteStream, mkdirSync } from "node:fs";
import { extname } from "node:path";
import { pipeline } from "node:stream/promises";

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post("/upload", async (request, reply) => {
    // Verifica se é multipart
    if (!request.isMultipart()) {
      return reply.status(406).send({ message: "Request must be multipart" });
    }

    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ message: "Arquivo não enviado" });
    }

    mkdirSync("uploads", { recursive: true });

    const fileExt = extname(data.filename);
    const fileName = `${Date.now()}${fileExt}`;
    const filePath = `uploads/${fileName}`;

    await pipeline(data.file, createWriteStream(filePath));

    const baseUrl = process.env.BASE_URL ?? `${request.protocol}://${request.hostname}`;
    const fileUrl = `${baseUrl}/uploads/${fileName}`;

    return reply.send({ fileUrl });
  });
}   