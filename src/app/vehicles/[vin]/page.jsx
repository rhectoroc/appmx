import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import {
  Car,
  ArrowLeft,
  Edit,
  Save,
  X,
  Calendar,
  MapPin,
  User,
  DollarSign,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";

function MainComponent({ params }) {
  const { data: user, loading: userLoading } = useUser();
  const [vehicle, setVehicle] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [userRole, setUserRole] = useState(null);

  const vin = params.vin;

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;

      try {
        const response = await fetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.user?.role || "client");
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setUserRole("client");
      }
    };

    fetchUserRole();
  }, [user]);

  // Fetch vehicle details
  useEffect(() => {
    const fetchVehicle = async () => {
      if (!user || !vin) return;

      setLoading(true);
      try {
        const response = await fetch(`/api/vehicles/${vin}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError(
              "Vehicle not found or you do not have permission to view it",
            );
          } else {
            setError("Failed to load vehicle details");
          }
          return;
        }

        const data = await response.json();
        setVehicle(data.vehicle);
        setServices(data.services || []);
        setEditData({
          description: data.vehicle.description || "",
          purchase_price: data.vehicle.purchase_price || "",
          current_status: data.vehicle.current_status || "purchased",
        });
      } catch (err) {
        console.error("Error fetching vehicle:", err);
        setError("Failed to load vehicle details");
      } finally {
        setLoading(false);
      }
    };

    fetchVehicle();
  }, [user, vin]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vehicles/${vin}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update vehicle");
      }

      setVehicle(data.vehicle);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      purchased: "bg-gray-100 text-gray-800",
      in_transit: "bg-blue-100 text-blue-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "in_progress":
        return <Clock className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading vehicle details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Please sign in to view vehicle details
          </p>
          <a
            href="/account/signin"
            className="text-blue-600 hover:text-blue-700"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Vehicle Not Found
          </h1>
          <p className="text-gray-600 mb-4">
            The vehicle you're looking for doesn't exist or you don't have
            permission to view it.
          </p>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Group services by category
  const operationalServices = services.filter(
    (s) => s.service_category === "operational",
  );
  const futureServices = services.filter(
    (s) => s.service_category === "future",
  );

  // Calculate totals
  const totalCosts = services.reduce((total, service) => {
    return total + (parseFloat(service.total_cost) || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <a
                href="/dashboard"
                className="flex items-center text-gray-600 hover:text-gray-900 mr-6"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Dashboard
              </a>
              <Car className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Vehicle Details
                </h1>
                <p className="text-sm text-gray-500">VIN: {vehicle.vin}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Vehicle
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditData({
                        description: vehicle.description || "",
                        purchase_price: vehicle.purchase_price || "",
                        current_status: vehicle.current_status || "purchased",
                      });
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Vehicle Information */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">
                  Vehicle Information
                </h2>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        VIN
                      </label>
                      <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
                        {vehicle.vin}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      {editing ? (
                        <textarea
                          value={editData.description}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              description: e.target.value,
                            })
                          }
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="3"
                          placeholder="Enter vehicle description..."
                        />
                      ) : (
                        <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
                          {vehicle.description || "No description provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Client
                      </label>
                      <div className="mt-1 flex items-center px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        {vehicle.client_name}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Purchase Price
                      </label>
                      {editing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editData.purchase_price}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              purchase_price: e.target.value,
                            })
                          }
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      ) : (
                        <div className="mt-1 flex items-center px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
                          <DollarSign className="h-4 w-4 text-gray-400 mr-2" />
                          {vehicle.purchase_price
                            ? `$${parseFloat(vehicle.purchase_price).toLocaleString()}`
                            : "Not specified"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Status
                      </label>
                      {editing ? (
                        <select
                          value={editData.current_status}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              current_status: e.target.value,
                            })
                          }
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="purchased">Purchased</option>
                          <option value="in_transit">In Transit</option>
                          <option value="completed">Completed</option>
                        </select>
                      ) : (
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(vehicle.current_status)}`}
                          >
                            {getStatusIcon(vehicle.current_status)}
                            <span className="ml-1 capitalize">
                              {vehicle.current_status?.replace("_", " ")}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Auction
                      </label>
                      <div className="mt-1 flex items-center px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
                        <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                        {vehicle.auction_name || "Not specified"}
                        {vehicle.auction_location && (
                          <span className="ml-2 text-gray-500">
                            ({vehicle.auction_location})
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Purchase Date
                      </label>
                      <div className="mt-1 flex items-center px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        {vehicle.purchase_date
                          ? new Date(vehicle.purchase_date).toLocaleDateString()
                          : "Not specified"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Services */}
            <div className="mt-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Services
              </h2>

              {operationalServices.length > 0 && (
                <div className="bg-white rounded-lg shadow mb-6">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-md font-medium text-gray-900">
                      Operational Services
                    </h3>
                  </div>
                  <div className="px-6 py-4">
                    <div className="space-y-4">
                      {operationalServices.map((service) => (
                        <div
                          key={service.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {service.service_name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {service.service_description}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}
                            >
                              {getStatusIcon(service.status)}
                              <span className="ml-1 capitalize">
                                {service.status?.replace("_", " ")}
                              </span>
                            </span>
                          </div>

                          {service.charges && service.charges.length > 0 && (
                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <h5 className="text-sm font-medium text-gray-900 mb-2">
                                Charges
                              </h5>
                              <div className="space-y-2">
                                {service.charges.map((charge, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between text-sm"
                                  >
                                    <span className="text-gray-600">
                                      {charge.charge_name}
                                    </span>
                                    <span className="font-medium">
                                      $
                                      {parseFloat(
                                        charge.total_amount || 0,
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-sm text-gray-500">
                              Total Cost
                            </span>
                            <span className="font-semibold text-lg">
                              $
                              {parseFloat(
                                service.total_cost || 0,
                              ).toLocaleString()}
                            </span>
                          </div>

                          {service.notes && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-sm text-gray-600">
                                <strong>Notes:</strong> {service.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {futureServices.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-md font-medium text-gray-900">
                      Future Services
                    </h3>
                  </div>
                  <div className="px-6 py-4">
                    <div className="space-y-4">
                      {futureServices.map((service) => (
                        <div
                          key={service.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {service.service_name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {service.service_description}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}
                            >
                              {getStatusIcon(service.status)}
                              <span className="ml-1 capitalize">
                                {service.status?.replace("_", " ")}
                              </span>
                            </span>
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-sm text-gray-500">
                              Total Cost
                            </span>
                            <span className="font-semibold text-lg">
                              $
                              {parseFloat(
                                service.total_cost || 0,
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {services.length === 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-12 text-center">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      No services
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No services have been assigned to this vehicle yet.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow sticky top-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Summary</h3>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">
                      Purchase Price
                    </span>
                    <span className="font-medium">
                      {vehicle.purchase_price
                        ? `$${parseFloat(vehicle.purchase_price).toLocaleString()}`
                        : "$0"}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">
                      Total Service Costs
                    </span>
                    <span className="font-medium">
                      ${totalCosts.toLocaleString()}
                    </span>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between">
                      <span className="text-base font-medium text-gray-900">
                        Total Investment
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        $
                        {(
                          (parseFloat(vehicle.purchase_price) || 0) + totalCosts
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500 space-y-2">
                      <div className="flex justify-between">
                        <span>Services Active</span>
                        <span>{operationalServices.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Services Completed</span>
                        <span>
                          {
                            services.filter((s) => s.status === "completed")
                              .length
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Services Pending</span>
                        <span>
                          {
                            services.filter((s) => s.status === "pending")
                              .length
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainComponent;
