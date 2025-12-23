import sql from "@/app/api/utils/sql";
import { hash } from "argon2";

// Create first admin user (should be deleted after use)
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 },
      );
    }

    // Check if email already exists
    const existingUser =
      await sql`SELECT id FROM auth_users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      return Response.json({ error: "Email already exists" }, { status: 400 });
    }

    // Create admin user
    const newUser = await sql`
      INSERT INTO auth_users (name, email, role, is_main_client)
      VALUES (${name}, ${email}, 'admin', false)
      RETURNING id, name, email, role
    `;

    // Create auth account with hashed password
    const hashedPassword = await hash(password);

    await sql`
      INSERT INTO auth_accounts (
        "userId", provider, type, "providerAccountId", password
      ) VALUES (
        ${newUser[0].id}, 'credentials', 'credentials', ${newUser[0].id}, ${hashedPassword}
      )
    `;

    return Response.json({
      message: "Admin user created successfully",
      user: {
        id: newUser[0].id,
        name: newUser[0].name,
        email: newUser[0].email,
        role: newUser[0].role,
      },
    });
  } catch (error) {
    console.error("POST /api/admin-setup error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
