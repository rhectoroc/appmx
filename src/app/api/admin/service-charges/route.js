import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get all service charges
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

    return Response.json({ charges });
  } catch (error) {
    console.error("GET /api/admin/service-charges error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Create new service charge
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
    const {
      service_id,
      charge_name,
      base_price,
      price_level,
      auction_specific,
      auction_id,
      markup_fee,
      financing_fee,
    } = body;

    if (!service_id || !charge_name || base_price === undefined) {
      return Response.json(
        {
          error: "Service ID, charge name, and base price are required",
        },
        { status: 400 },
      );
    }

    if (auction_specific && !auction_id) {
      return Response.json(
        {
          error: "Auction ID is required when charge is auction-specific",
        },
        { status: 400 },
      );
    }

    const newCharge = await sql`
      INSERT INTO service_charges (
        service_id, 
        charge_name, 
        base_price, 
        price_level, 
        auction_specific, 
        auction_id,
        markup_fee,
        financing_fee
      )
      VALUES (
        ${service_id}, 
        ${charge_name}, 
        ${base_price}, 
        ${price_level || null}, 
        ${auction_specific || false}, 
        ${auction_id || null},
        ${markup_fee || 0},
        ${financing_fee || 0}
      )
      RETURNING *
    `;

    return Response.json({ charge: newCharge[0] });
  } catch (error) {
    console.error("POST /api/admin/service-charges error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
