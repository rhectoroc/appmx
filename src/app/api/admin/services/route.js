import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get all services with their charges
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

    // Get services
    const services = await sql`
      SELECT * FROM services 
      ORDER BY category, name ASC
    `;

    // Get service charges
    const charges = await sql`
      SELECT 
        sc.*,
        s.name as service_name,
        a.name as auction_name
      FROM service_charges sc
      LEFT JOIN services s ON sc.service_id = s.id
      LEFT JOIN auctions a ON sc.auction_id = a.id
      ORDER BY s.name, sc.charge_name
    `;

    return Response.json({ services, charges });
  } catch (error) {
    console.error("GET /api/admin/services error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Create new service
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
    const { name, description, category, is_active } = body;

    if (!name || !category) {
      return Response.json(
        { error: "Name and category are required" },
        { status: 400 },
      );
    }

    if (!["operational", "future"].includes(category)) {
      return Response.json(
        { error: "Category must be 'operational' or 'future'" },
        { status: 400 },
      );
    }

    const newService = await sql`
      INSERT INTO services (name, description, category, is_active)
      VALUES (${name}, ${description || null}, ${category}, ${is_active !== false})
      RETURNING *
    `;

    return Response.json({ service: newService[0] });
  } catch (error) {
    console.error("POST /api/admin/services error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
