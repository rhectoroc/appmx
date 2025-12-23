import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const includeServices = searchParams.get("includeServices") === "true";

    // Check user role and permissions
    const userRows =
      await sql`SELECT role, id FROM auth_users WHERE id = ${session.user.id}`;
    const currentUser = userRows[0];

    if (!currentUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Build query based on user role
    let vehicleQuery;
    if (currentUser.role === "admin") {
      vehicleQuery = sql`
        SELECT 
          v.id,
          v.vin,
          v.description,
          v.purchase_price,
          v.purchase_date,
          v.current_status,
          v.created_at,
          u.name as client_name,
          u.email as client_email,
          u.role as client_role,
          a.name as auction_name,
          a.location as auction_location,
          COALESCE(SUM(vsd.total_cost), 0) as total_service_costs
        FROM vehicles v
        LEFT JOIN auth_users u ON v.client_id = u.id
        LEFT JOIN auctions a ON v.auction_id = a.id
        LEFT JOIN vehicle_service_details vsd ON v.id = vsd.vehicle_id
        GROUP BY v.id, u.id, a.id
        ORDER BY v.created_at DESC
      `;
    } else {
      vehicleQuery = sql`
        SELECT 
          v.id,
          v.vin,
          v.description,
          v.purchase_price,
          v.purchase_date,
          v.current_status,
          v.created_at,
          u.name as client_name,
          a.name as auction_name,
          a.location as auction_location,
          COALESCE(SUM(vsd.total_cost), 0) as total_service_costs
        FROM vehicles v
        LEFT JOIN auth_users u ON v.client_id = u.id
        LEFT JOIN auctions a ON v.auction_id = a.id
        LEFT JOIN vehicle_service_details vsd ON v.id = vsd.vehicle_id
        WHERE v.client_id = ${session.user.id}
        GROUP BY v.id, u.id, a.id
        ORDER BY v.created_at DESC
      `;
    }

    const vehicles = await vehicleQuery;

    // Get service details if requested
    let serviceDetails = [];
    if (includeServices && vehicles.length > 0) {
      const vehicleIds = vehicles.map((v) => v.id);
      serviceDetails = await sql`
        SELECT 
          vsd.vehicle_id,
          v.vin,
          s.name as service_name,
          s.category as service_category,
          vsd.status as service_status,
          vsd.total_cost as service_cost,
          vsd.start_date,
          vsd.completion_date,
          vsd.notes
        FROM vehicle_service_details vsd
        JOIN vehicles v ON vsd.vehicle_id = v.id
        JOIN services s ON vsd.service_id = s.id
        WHERE vsd.vehicle_id = ANY(${vehicleIds})
        ORDER BY v.vin, s.category, s.name
      `;
    }

    if (format === "csv") {
      // Generate CSV content
      let csvContent = "";

      // Vehicle headers
      const vehicleHeaders = [
        "VIN",
        "Description",
        "Client Name",
        "Client Email",
        currentUser.role === "admin" ? "Client Role" : "",
        "Auction Name",
        "Auction Location",
        "Purchase Price",
        "Purchase Date",
        "Current Status",
        "Total Service Costs",
        "Total Investment",
        "Created Date",
      ].filter(Boolean);

      csvContent += vehicleHeaders.join(",") + "\n";

      // Vehicle data
      vehicles.forEach((vehicle) => {
        const totalInvestment =
          (parseFloat(vehicle.purchase_price) || 0) +
          (parseFloat(vehicle.total_service_costs) || 0);
        const row = [
          `"${vehicle.vin || ""}"`,
          `"${vehicle.description || ""}"`,
          `"${vehicle.client_name || ""}"`,
          `"${vehicle.client_email || ""}"`,
          currentUser.role === "admin" ? `"${vehicle.client_role || ""}"` : "",
          `"${vehicle.auction_name || ""}"`,
          `"${vehicle.auction_location || ""}"`,
          vehicle.purchase_price || "0",
          vehicle.purchase_date
            ? new Date(vehicle.purchase_date).toISOString().split("T")[0]
            : "",
          `"${vehicle.current_status || ""}"`,
          vehicle.total_service_costs || "0",
          totalInvestment.toFixed(2),
          vehicle.created_at
            ? new Date(vehicle.created_at).toISOString().split("T")[0]
            : "",
        ].filter(Boolean);

        csvContent += row.join(",") + "\n";
      });

      // Add service details if requested
      if (includeServices && serviceDetails.length > 0) {
        csvContent += "\n\nService Details:\n";
        const serviceHeaders = [
          "VIN",
          "Service Name",
          "Service Category",
          "Service Status",
          "Service Cost",
          "Start Date",
          "Completion Date",
          "Notes",
        ];
        csvContent += serviceHeaders.join(",") + "\n";

        serviceDetails.forEach((service) => {
          const row = [
            `"${service.vin || ""}"`,
            `"${service.service_name || ""}"`,
            `"${service.service_category || ""}"`,
            `"${service.service_status || ""}"`,
            service.service_cost || "0",
            service.start_date
              ? new Date(service.start_date).toISOString().split("T")[0]
              : "",
            service.completion_date
              ? new Date(service.completion_date).toISOString().split("T")[0]
              : "",
            `"${service.notes || ""}"`,
          ];
          csvContent += row.join(",") + "\n";
        });
      }

      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="vehicles_export_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    } else {
      // Return JSON
      return Response.json({
        vehicles,
        serviceDetails: includeServices ? serviceDetails : undefined,
        exportDate: new Date().toISOString(),
        totalVehicles: vehicles.length,
      });
    }
  } catch (error) {
    console.error("GET /api/export/vehicles error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
