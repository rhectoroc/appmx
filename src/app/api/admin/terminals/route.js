import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get all terminals
export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
    if (!userRows[0] || userRows[0].role !== "admin") {
      return Response.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const terminals = await sql`
      SELECT * FROM shippers_terminals 
      ORDER BY name ASC
    `;

    return Response.json({ terminals });
  } catch (error) {
    console.error("GET /api/admin/terminals error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Create new terminal
export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
    if (!userRows[0] || userRows[0].role !== "admin") {
      return Response.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name, location, address, postal_code } = body;

    if (!name || !location) {
      return Response.json(
        { error: "Name and location are required" },
        { status: 400 },
      );
    }

    const newTerminal = await sql`
      INSERT INTO shippers_terminals (name, location, address, postal_code)
      VALUES (${name}, ${location}, ${address || null}, ${postal_code || null})
      RETURNING *
    `;

    return Response.json({ terminal: newTerminal[0] });
  } catch (error) {
    console.error("POST /api/admin/terminals error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
