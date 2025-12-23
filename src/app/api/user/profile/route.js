import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get current user profile with role information
export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user with role and hierarchy information
    const userRows = await sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_main_client,
        u.main_client_id,
        main.name as main_client_name
      FROM auth_users u
      LEFT JOIN auth_users main ON u.main_client_id = main.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;

    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const user = userRows[0];

    // If this is a main client, get their sub-clients
    let subClients = [];
    if (user.is_main_client) {
      subClients = await sql`
        SELECT 
          u.id,
          u.name,
          u.email
        FROM auth_users u
        INNER JOIN client_hierarchy ch ON u.id = ch.sub_client_id
        WHERE ch.main_client_id = ${userId}
        ORDER BY u.name
      `;
    }

    return Response.json({
      user: {
        ...user,
        sub_clients: subClients,
      },
    });
  } catch (error) {
    console.error("GET /api/user/profile error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Update user profile
export async function PUT(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    // Only allow updating certain fields
    const allowedFields = ["name"];
    const setClauses = [];
    const values = [];
    let paramCount = 0;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        paramCount++;
        setClauses.push(`${field} = $${paramCount}`);
        values.push(body[field]);
      }
    }

    if (setClauses.length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // Add WHERE clause
    paramCount++;
    values.push(userId);

    const updateQuery = `
      UPDATE auth_users 
      SET ${setClauses.join(", ")} 
      WHERE id = $${paramCount}
      RETURNING id, name, email, role, is_main_client, main_client_id
    `;

    const updatedUser = await sql(updateQuery, values);

    return Response.json({ user: updatedUser[0] });
  } catch (error) {
    console.error("PUT /api/user/profile error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
