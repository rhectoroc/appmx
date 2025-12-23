import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const clientId = searchParams.get("clientId");

    // Check user role and permissions
    const userRows =
      await sql`SELECT role, id FROM auth_users WHERE id = ${session.user.id}`;
    const currentUser = userRows[0];

    if (!currentUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Build base query with role-based filtering
    let whereClause = "WHERE 1=1";
    let queryParams = [];

    if (currentUser.role !== "admin") {
      whereClause += " AND v.client_id = $" + (queryParams.length + 1);
      queryParams.push(session.user.id);
    }

    if (startDate) {
      whereClause += " AND v.purchase_date >= $" + (queryParams.length + 1);
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += " AND v.purchase_date <= $" + (queryParams.length + 1);
      queryParams.push(endDate);
    }

    if (clientId && currentUser.role === "admin") {
      whereClause += " AND v.client_id = $" + (queryParams.length + 1);
      queryParams.push(clientId);
    }

    // Financial overview query
    const financialOverview = await sql(
      `SELECT 
        COUNT(v.id) as total_vehicles,
        COALESCE(SUM(v.purchase_price), 0) as total_purchase_value,
        COALESCE(SUM(vsd.total_cost), 0) as total_service_costs,
        COALESCE(SUM(v.purchase_price + vsd.total_cost), 0) as total_investment,
        AVG(v.purchase_price) as avg_purchase_price,
        AVG(vsd.total_cost) as avg_service_cost
      FROM vehicles v
      LEFT JOIN (
        SELECT vehicle_id, SUM(total_cost) as total_cost
        FROM vehicle_service_details
        GROUP BY vehicle_id
      ) vsd ON v.id = vsd.vehicle_id
      ${whereClause}`,
      queryParams,
    );

    // Monthly trends
    const monthlyTrends = await sql(
      `SELECT 
        DATE_TRUNC('month', v.purchase_date) as month,
        COUNT(v.id) as vehicles_purchased,
        COALESCE(SUM(v.purchase_price), 0) as monthly_purchase_value,
        COALESCE(SUM(vsd.total_cost), 0) as monthly_service_costs
      FROM vehicles v
      LEFT JOIN (
        SELECT vehicle_id, SUM(total_cost) as total_cost
        FROM vehicle_service_details
        GROUP BY vehicle_id
      ) vsd ON v.id = vsd.vehicle_id
      ${whereClause}
      AND v.purchase_date IS NOT NULL
      GROUP BY DATE_TRUNC('month', v.purchase_date)
      ORDER BY month DESC
      LIMIT 12`,
      queryParams,
    );

    // Service cost breakdown
    const serviceCostBreakdown = await sql(
      `SELECT 
        s.name as service_name,
        s.category as service_category,
        COUNT(vsd.id) as service_count,
        COALESCE(SUM(vsd.total_cost), 0) as total_service_cost,
        COALESCE(AVG(vsd.total_cost), 0) as avg_service_cost
      FROM vehicle_service_details vsd
      JOIN services s ON vsd.service_id = s.id
      JOIN vehicles v ON vsd.vehicle_id = v.id
      ${whereClause.replace("WHERE 1=1", "WHERE 1=1")}
      GROUP BY s.id, s.name, s.category
      ORDER BY total_service_cost DESC`,
      queryParams,
    );

    // Client breakdown (admin only)
    let clientBreakdown = [];
    if (currentUser.role === "admin") {
      clientBreakdown = await sql`
        SELECT 
          u.name as client_name,
          u.email as client_email,
          u.role as client_role,
          COUNT(v.id) as vehicle_count,
          COALESCE(SUM(v.purchase_price), 0) as total_purchase_value,
          COALESCE(SUM(vsd.total_cost), 0) as total_service_costs
        FROM auth_users u
        LEFT JOIN vehicles v ON u.id = v.client_id
        LEFT JOIN (
          SELECT vehicle_id, SUM(total_cost) as total_cost
          FROM vehicle_service_details
          GROUP BY vehicle_id
        ) vsd ON v.id = vsd.vehicle_id
        WHERE u.role IN ('client', 'main_client')
        GROUP BY u.id, u.name, u.email, u.role
        ORDER BY total_purchase_value DESC
      `;
    }

    // Vehicle status distribution
    const statusDistribution = await sql(
      `SELECT 
        v.current_status,
        COUNT(v.id) as count,
        COALESCE(SUM(v.purchase_price), 0) as total_value
      FROM vehicles v
      ${whereClause}
      GROUP BY v.current_status
      ORDER BY count DESC`,
      queryParams,
    );

    return Response.json({
      overview: financialOverview[0],
      monthlyTrends,
      serviceCostBreakdown,
      clientBreakdown,
      statusDistribution,
    });
  } catch (error) {
    console.error("GET /api/reports/financial error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
