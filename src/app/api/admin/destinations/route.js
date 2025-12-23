import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get all destinations
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

    const destinations = await sql`
      SELECT * FROM destinations 
      ORDER BY country_name ASC
    `;

    return Response.json({ destinations });
  } catch (error) {
    console.error("GET /api/admin/destinations error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Create new destination
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
    const { country_name, country_code, port_name } = body;

    if (!country_name) {
      return Response.json(
        { error: "Country name is required" },
        { status: 400 },
      );
    }

    const newDestination = await sql`
      INSERT INTO destinations (country_name, country_code, port_name)
      VALUES (${country_name}, ${country_code || null}, ${port_name || null})
      RETURNING *
    `;

    return Response.json({ destination: newDestination[0] });
  } catch (error) {
    console.error("POST /api/admin/destinations error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
