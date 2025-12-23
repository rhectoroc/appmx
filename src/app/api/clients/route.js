import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get all clients (admin only)
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

    const clients = await sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_main_client,
        u.main_client_id,
        u.created_at,
        main.name as main_client_name
      FROM auth_users u
      LEFT JOIN auth_users main ON u.main_client_id = main.id
      WHERE u.role IN ('client', 'main_client', 'sub_client')
      ORDER BY u.is_main_client DESC, u.name ASC
    `;

    return Response.json({ clients });
  } catch (error) {
    console.error("GET /api/clients error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Create new client (admin only)
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
    const { name, email, password, role, main_client_id } = body;

    if (!name || !email || !password || !role) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!["client", "main_client", "sub_client"].includes(role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if email already exists
    const existingUser =
      await sql`SELECT id FROM auth_users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      return Response.json({ error: "Email already exists" }, { status: 400 });
    }

    // Create user
    const newUser = await sql`
      INSERT INTO auth_users (name, email, role, is_main_client, main_client_id)
      VALUES (${name}, ${email}, ${role}, ${role === "main_client"}, ${main_client_id || null})
      RETURNING id, name, email, role, is_main_client, main_client_id
    `;

    // Create auth account with hashed password
    const { hash } = await import("argon2");
    const hashedPassword = await hash(password);

    await sql`
      INSERT INTO auth_accounts (
        "userId", provider, type, "providerAccountId", password
      ) VALUES (
        ${newUser[0].id}, 'credentials', 'credentials', ${newUser[0].id}, ${hashedPassword}
      )
    `;

    // If this is a sub_client, create hierarchy relationship
    if (role === "sub_client" && main_client_id) {
      await sql`
        INSERT INTO client_hierarchy (main_client_id, sub_client_id)
        VALUES (${main_client_id}, ${newUser[0].id})
      `;
    }

    return Response.json({ client: newUser[0] });
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
