import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get vehicle details by VIN
export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vin } = params;

    // Get user info
    const userRows =
      await sql`SELECT role, is_main_client FROM auth_users WHERE id = ${session.user.id}`;
    const user = userRows[0];

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Get vehicle with all related information
    let vehicleQuery;

    if (user.role === "admin") {
      vehicleQuery = sql`
        SELECT 
          v.*,
          u.name as client_name,
          u.email as client_email,
          a.name as auction_name,
          a.location as auction_location,
          a.address as auction_address
        FROM vehicles v
        LEFT JOIN auth_users u ON v.client_id = u.id
        LEFT JOIN auctions a ON v.auction_id = a.id
        WHERE v.vin = ${vin}
      `;
    } else if (user.is_main_client) {
      vehicleQuery = sql`
        SELECT 
          v.*,
          u.name as client_name,
          u.email as client_email,
          a.name as auction_name,
          a.location as auction_location,
          a.address as auction_address
        FROM vehicles v
        LEFT JOIN auth_users u ON v.client_id = u.id
        LEFT JOIN auctions a ON v.auction_id = a.id
        WHERE v.vin = ${vin}
          AND (v.client_id = ${session.user.id}
               OR v.client_id IN (
                 SELECT sub_client_id 
                 FROM client_hierarchy 
                 WHERE main_client_id = ${session.user.id}
               ))
      `;
    } else {
      vehicleQuery = sql`
        SELECT 
          v.*,
          u.name as client_name,
          u.email as client_email,
          a.name as auction_name,
          a.location as auction_location,
          a.address as auction_address
        FROM vehicles v
        LEFT JOIN auth_users u ON v.client_id = u.id
        LEFT JOIN auctions a ON v.auction_id = a.id
        WHERE v.vin = ${vin} AND v.client_id = ${session.user.id}
      `;
    }

    const vehicleRows = await vehicleQuery;

    if (vehicleRows.length === 0) {
      return Response.json(
        { error: "Vehicle not found or access denied" },
        { status: 404 },
      );
    }

    const vehicle = vehicleRows[0];

    // Get all service details for this vehicle
    const serviceDetails = await sql`
      SELECT 
        vsd.*,
        s.name as service_name,
        s.description as service_description,
        s.category as service_category
      FROM vehicle_service_details vsd
      LEFT JOIN services s ON vsd.service_id = s.id
      WHERE vsd.vehicle_id = ${vehicle.id}
      ORDER BY s.category, s.name
    `;

    // Get all charges for each service
    const serviceCharges = await sql`
      SELECT 
        vsc.*,
        sc.charge_name,
        sc.base_price,
        vsd.service_id
      FROM vehicle_service_charges vsc
      LEFT JOIN service_charges sc ON vsc.service_charge_id = sc.id
      LEFT JOIN vehicle_service_details vsd ON vsc.vehicle_service_detail_id = vsd.id
      WHERE vsd.vehicle_id = ${vehicle.id}
    `;

    // Group charges by service
    const chargesByService = {};
    serviceCharges.forEach((charge) => {
      if (!chargesByService[charge.service_id]) {
        chargesByService[charge.service_id] = [];
      }
      chargesByService[charge.service_id].push(charge);
    });

    // Add charges to service details
    const servicesWithCharges = serviceDetails.map((service) => ({
      ...service,
      charges: chargesByService[service.service_id] || [],
    }));

    return Response.json({
      vehicle,
      services: servicesWithCharges,
    });
  } catch (error) {
    console.error("GET /api/vehicles/[vin] error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Update vehicle
export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vin } = params;
    const body = await request.json();

    // Get user info
    const userRows =
      await sql`SELECT role, is_main_client FROM auth_users WHERE id = ${session.user.id}`;
    const user = userRows[0];

    // Get vehicle to check permissions
    const vehicleRows = await sql`SELECT * FROM vehicles WHERE vin = ${vin}`;
    if (vehicleRows.length === 0) {
      return Response.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const vehicle = vehicleRows[0];

    // Check permissions
    if (user.role !== "admin") {
      if (vehicle.client_id !== session.user.id) {
        if (!user.is_main_client) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        const hierarchyCheck = await sql`
          SELECT id FROM client_hierarchy 
          WHERE main_client_id = ${session.user.id} AND sub_client_id = ${vehicle.client_id}
        `;

        if (hierarchyCheck.length === 0) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Build update query
    const setClauses = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      "description",
      "auction_id",
      "purchase_price",
      "purchase_date",
      "current_status",
    ];

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

    // Add updated_at
    paramCount++;
    setClauses.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add WHERE clause
    paramCount++;
    values.push(vin);

    const updateQuery = `
      UPDATE vehicles 
      SET ${setClauses.join(", ")} 
      WHERE vin = $${paramCount}
      RETURNING *
    `;

    const updatedVehicle = await sql(updateQuery, values);

    return Response.json({ vehicle: updatedVehicle[0] });
  } catch (error) {
    console.error("PUT /api/vehicles/[vin] error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
