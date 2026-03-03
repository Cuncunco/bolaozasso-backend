import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
export async function requireAuth(request, reply) {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer "))
        return reply.code(401).send({ message: "Sem token" });
    const token = auth.slice("Bearer ".length);
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        request.userId = payload.sub;
    }
    catch {
        return reply.code(401).send({ message: "Token inválido" });
    }
}
//# sourceMappingURL=requireAuth.js.map