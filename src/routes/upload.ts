import { FastifyInstance } from "fastify";
import { createWriteStream, mkdirSync } from "node:fs";
import { extname } from "node:path";
import pump from "pump";

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post("/upload", async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ message: "Arquivo não enviado" });
    }

    mkdirSync("uploads", { recursive: true });

    const fileExt = extname(data.filename);
    const fileName = `${Date.now()}${fileExt}`;
    const filePath = `uploads/${fileName}`;

    await pump(data.file, createWriteStream(filePath));

    const fileUrl = `${request.protocol}://${request.hostname}/uploads/${fileName}`;

    return reply.send({ fileUrl });
  });
}