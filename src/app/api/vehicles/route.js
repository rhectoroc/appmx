import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get vehicles based on user role
export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get("client_id");

    // Get user info
    const userRows =
      await sql`SELECT role, is_main_client FROM auth_users WHERE id = ${session.user.id}`;
    const user = userRows[0];

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    let vehicles;

    if (user.role === "admin") {
      // Admin can see all vehicles, optionally filtered by client
      if (clientId) {
        vehicles = await sql`
          SELECT 
            v.*,
            u.name as client_name,
            u.email as client_email,
            a.name as auction_name,
            a.location as auction_location
          FROM vehicles v
          LEFT JOIN auth_users u ON v.client_id = u.id
          LEFT JOIN auctions a ON v.auction_id = a.id
          WHERE v.client_id = ${clientId}
          ORDER BY v.created_at DESC
        `;
      } else {
        vehicles = await sql`
          SELECT 
            v.*,
            u.name as client_name,
            u.email as client_email,
            a.name as auction_name,
            a.location as auction_location
          FROM vehicles v
          LEFT JOIN auth_users u ON v.client_id = u.id
          LEFT JOIN auctions a ON v.auction_id = a.id
          ORDER BY v.created_at DESC
        `;
      }
    } else if (user.is_main_client) {
      // Main client can see their own vehicles and their sub-clients' vehicles
      vehicles = await sql`
        SELECT 
          v.*,
          u.name as client_name,
          u.email as client_email,
          a.name as auction_name,
          a.location as auction_location,
          CASE 
            WHEN v.client_id = ${session.user.id} THEN 'own'
            ELSE 'sub_client'
          END as ownership_type
        FROM vehicles v
        LEFT JOIN auth_users u ON v.client_id = u.id
        LEFT JOIN auctions a ON v.auction_id = a.id
        WHERE v.client_id = ${session.user.id}
           OR v.client_id IN (
             SELECT sub_client_id 
             FROM client_hierarchy 
             WHERE main_client_id = ${session.user.id}
           )
        ORDER BY v.created_at DESC
      `;
    } else {
      // Sub-client can only see their own vehicles
      vehicles = await sql`
        SELECT 
          v.*,
          u.name as client_name,
          u.email as client_email,
          a.name as auction_name,
          a.location as auction_location
        FROM vehicles v
        LEFT JOIN auth_users u ON v.client_id = u.id
        LEFT JOIN auctions a ON v.auction_id = a.id
        WHERE v.client_id = ${session.user.id}
        ORDER BY v.created_at DESC
      `;
    }

    return Response.json({ vehicles });
  } catch (error) {
    console.error("GET /api/vehicles error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Create new vehicle
export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      vin,
      client_id,
      description,
      auction_id,
      purchase_price,
      purchase_date,
    } = body;

    if (!vin || !client_id) {
      return Response.json(
        { error: "VIN and client_id are required" },
        { status: 400 },
      );
    }

    // Validate VIN format (17 characters)
    if (vin.length !== 17) {
      return Response.json(
        { error: "VIN must be exactly 17 characters" },
        { status: 400 },
      );
    }

    // Check if VIN already exists
    const existingVehicle =
      await sql`SELECT id FROM vehicles WHERE vin = ${vin}`;
    if (existingVehicle.length > 0) {
      return Response.json(
        { error: "Vehicle with this VIN already exists" },
        { status: 400 },
      );
    }

    // Get user info to check permissions
    const userRows =
      await sql`SELECT role, is_main_client FROM auth_users WHERE id = ${session.user.id}`;
    const user = userRows[0];

    // Check if user can create vehicle for this client
    if (user.role !== "admin") {
      if (client_id !== session.user.id) {
        // Check if it's a main client creating for their sub-client
        if (!user.is_main_client) {
          return Response.json(
            { error: "Forbidden - Cannot create vehicle for other clients" },
            { status: 403 },
          );
        }

        const hierarchyCheck = await sql`
          SELECT id FROM client_hierarchy 
          WHERE main_client_id = ${session.user.id} AND sub_client_id = ${client_id}
        `;

        if (hierarchyCheck.length === 0) {
          return Response.json(
            { error: "Forbidden - Cannot create vehicle for this client" },
            { status: 403 },
          );
        }
      }
    }

    // Create vehicle
    const newVehicle = await sql`
      INSERT INTO vehicles (
        vin, client_id, description, auction_id, purchase_price, purchase_date, current_status
      ) VALUES (
        ${vin}, ${client_id}, ${description || null}, ${auction_id || null}, 
        ${purchase_price || null}, ${purchase_date || null}, 'purchased'
      )
      RETURNING *
    `;

    // Create initial service records for all services
    const services = await sql`SELECT id FROM services WHERE is_active = true`;

    for (const service of services) {
      await sql`
        INSERT INTO vehicle_service_details (vehicle_id, service_id, status)
        VALUES (${newVehicle[0].id}, ${service.id}, 'pending')
      `;
    }

    return Response.json({ vehicle: newVehicle[0] });
  } catch (error) {
    console.error("POST /api/vehicles error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
