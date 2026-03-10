import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error("JWT_SECRET not set");

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.code(401).send({ message: "Token não informado" });
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return reply.code(401).send({ message: "Token inválido" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };

    (request as any).userId = decoded.sub;
  } catch {
    return reply.code(401).send({ message: "Token inválido" });
  }
}