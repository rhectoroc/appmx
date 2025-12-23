import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    const userRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
    if (!userRows[0] || userRows[0].role !== "admin") {
      return Response.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { vehicles, validateOnly = false } = body;

    if (!Array.isArray(vehicles)) {
      return Response.json(
        { error: "Vehicles data must be an array" },
        { status: 400 },
      );
    }

    const validationErrors = [];
    const validVehicles = [];

    // Get all clients and auctions for validation
    const [allClients, allAuctions] = await sql.transaction([
      sql`SELECT id, email FROM auth_users WHERE role IN ('client', 'main_client')`,
      sql`SELECT id, name FROM auctions`,
    ]);

    const clientEmailMap = new Map(allClients.map((c) => [c.email, c.id]));
    const auctionNameMap = new Map(allAuctions.map((a) => [a.name, a.id]));

    // Validate each vehicle
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      const rowErrors = [];

      // Validate required fields
      if (
        !vehicle.vin ||
        typeof vehicle.vin !== "string" ||
        vehicle.vin.length !== 17
      ) {
        rowErrors.push("VIN must be exactly 17 characters");
      }

      if (!vehicle.client_email || typeof vehicle.client_email !== "string") {
        rowErrors.push("Client email is required");
      } else if (!clientEmailMap.has(vehicle.client_email)) {
        rowErrors.push(`Client with email "${vehicle.client_email}" not found`);
      }

      // Validate optional fields
      if (vehicle.purchase_price && isNaN(parseFloat(vehicle.purchase_price))) {
        rowErrors.push("Purchase price must be a valid number");
      }

      if (vehicle.purchase_date && !isValidDate(vehicle.purchase_date)) {
        rowErrors.push("Purchase date must be in YYYY-MM-DD format");
      }

      if (vehicle.auction_name && !auctionNameMap.has(vehicle.auction_name)) {
        rowErrors.push(`Auction "${vehicle.auction_name}" not found`);
      }

      if (
        vehicle.current_status &&
        !["purchased", "in_transit", "completed"].includes(
          vehicle.current_status,
        )
      ) {
        rowErrors.push(
          "Current status must be one of: purchased, in_transit, completed",
        );
      }

      if (rowErrors.length > 0) {
        validationErrors.push({
          row: i + 1,
          vin: vehicle.vin,
          errors: rowErrors,
        });
      } else {
        // Prepare valid vehicle data
        validVehicles.push({
          vin: vehicle.vin,
          client_id: clientEmailMap.get(vehicle.client_email),
          description: vehicle.description || null,
          auction_id: vehicle.auction_name
            ? auctionNameMap.get(vehicle.auction_name)
            : null,
          purchase_price: vehicle.purchase_price
            ? parseFloat(vehicle.purchase_price)
            : null,
          purchase_date: vehicle.purchase_date
            ? new Date(vehicle.purchase_date)
            : null,
          current_status: vehicle.current_status || "purchased",
        });
      }
    }

    // If validation only, return results
    if (validateOnly) {
      return Response.json({
        valid: validationErrors.length === 0,
        validCount: validVehicles.length,
        errorCount: validationErrors.length,
        errors: validationErrors,
      });
    }

    // If there are validation errors, don't proceed with import
    if (validationErrors.length > 0) {
      return Response.json(
        {
          error: "Validation failed",
          validCount: validVehicles.length,
          errorCount: validationErrors.length,
          errors: validationErrors,
        },
        { status: 400 },
      );
    }

    // Check for duplicate VINs in the database
    const existingVins = await sql`
      SELECT vin FROM vehicles 
      WHERE vin = ANY(${validVehicles.map((v) => v.vin)})
    `;

    if (existingVins.length > 0) {
      return Response.json(
        {
          error: "Some VINs already exist in the database",
          duplicateVins: existingVins.map((v) => v.vin),
        },
        { status: 409 },
      );
    }

    // Insert vehicles
    const insertedVehicles = [];
    for (const vehicle of validVehicles) {
      try {
        const newVehicle = await sql`
          INSERT INTO vehicles (
            vin, 
            client_id, 
            description, 
            auction_id, 
            purchase_price, 
            purchase_date, 
            current_status
          )
          VALUES (
            ${vehicle.vin},
            ${vehicle.client_id},
            ${vehicle.description},
            ${vehicle.auction_id},
            ${vehicle.purchase_price},
            ${vehicle.purchase_date},
            ${vehicle.current_status}
          )
          RETURNING *
        `;
        insertedVehicles.push(newVehicle[0]);
      } catch (insertError) {
        console.error(`Error inserting vehicle ${vehicle.vin}:`, insertError);
        validationErrors.push({
          vin: vehicle.vin,
          errors: [`Database error: ${insertError.message}`],
        });
      }
    }

    return Response.json({
      success: true,
      importedCount: insertedVehicles.length,
      totalSubmitted: vehicles.length,
      vehicles: insertedVehicles,
      errors: validationErrors.length > 0 ? validationErrors : undefined,
    });
  } catch (error) {
    console.error("POST /api/import/vehicles error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function isValidDate(dateString) {
  const date = new Date(dateString);
  return (
    date instanceof Date &&
    !isNaN(date) &&
    dateString.match(/^\d{4}-\d{2}-\d{2}$/)
  );
}
