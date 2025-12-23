import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import {
  Shield,
  Settings,
  Users,
  Car,
  MapPin,
  Ship,
  Globe,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Building,
  Home,
  AlertTriangle,
} from "lucide-react";

function MainComponent() {
  const { data: user, loading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState("overview");
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data states
  const [auctions, setAuctions] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [charges, setCharges] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("");
  const [formData, setFormData] = useState({});

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

  // Fetch all data when admin panel loads
  useEffect(() => {
    const fetchAllData = async () => {
      if (userRole !== "admin") return;

      setLoading(true);
      try {
        // Fetch all admin data
        const [
          auctionsRes,
          terminalsRes,
          destinationsRes,
          clientsRes,
          servicesRes,
          vehiclesRes,
        ] = await Promise.all([
          fetch("/api/admin/auctions"),
          fetch("/api/admin/terminals"),
          fetch("/api/admin/destinations"),
          fetch("/api/clients"),
          fetch("/api/admin/services"),
          fetch("/api/vehicles"),
        ]);

        if (auctionsRes.ok) {
          const data = await auctionsRes.json();
          setAuctions(data.auctions || []);
        }

        if (terminalsRes.ok) {
          const data = await terminalsRes.json();
          setTerminals(data.terminals || []);
        }

        if (destinationsRes.ok) {
          const data = await destinationsRes.json();
          setDestinations(data.destinations || []);
        }

        if (clientsRes.ok) {
          const data = await clientsRes.json();
          setClients(data.clients || []);
        }

        if (servicesRes.ok) {
          const data = await servicesRes.json();
          setServices(data.services || []);
          setCharges(data.charges || []);
        }

        if (vehiclesRes.ok) {
          const data = await vehiclesRes.json();
          setVehicles(data.vehicles || []);
        }
      } catch (err) {
        console.error("Error fetching admin data:", err);
        setError("Failed to load admin data");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [userRole]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = getEndpointForFormType(formType);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create record");
      }

      // Update local state based on form type
      if (formType === "auction") {
        setAuctions([...auctions, data.auction]);
      } else if (formType === "terminal") {
        setTerminals([...terminals, data.terminal]);
      } else if (formType === "destination") {
        setDestinations([...destinations, data.destination]);
      } else if (formType === "client") {
        setClients([...clients, data.client]);
      } else if (formType === "service") {
        setServices([...services, data.service]);
      } else if (formType === "charge") {
        setCharges([...charges, data.charge]);
      }

      // Reset form
      setShowForm(false);
      setFormData({});
      setFormType("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getEndpointForFormType = (type) => {
    const endpoints = {
      auction: "/api/admin/auctions",
      terminal: "/api/admin/terminals",
      destination: "/api/admin/destinations",
      client: "/api/clients",
      service: "/api/admin/services",
      charge: "/api/admin/service-charges",
    };
    return endpoints[type];
  };

  const openForm = (type) => {
    setFormType(type);
    setFormData({});
    setShowForm(true);
    setError(null);
  };

  if (
    userLoading ||
    (userRole === "admin" && loading && activeTab === "overview")
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Please sign in to access the admin panel
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

  if (userRole !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            You need administrator privileges to access this panel
          </p>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", name: "Overview", icon: Shield },
    { id: "auctions", name: "Auctions", icon: Building },
    { id: "terminals", name: "Terminals", icon: Ship },
    { id: "destinations", name: "Destinations", icon: Globe },
    { id: "clients", name: "Clients", icon: Users },
    { id: "services", name: "Services", icon: Settings },
    { id: "vehicles", name: "Vehicles", icon: Car },
  ];

  const stats = {
    totalAuctions: auctions.length,
    totalTerminals: terminals.length,
    totalDestinations: destinations.length,
    totalClients: clients.length,
    totalServices: services.length,
    totalVehicles: vehicles.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-purple-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.name || user.email}
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                Administrator
              </span>
              <a
                href="/dashboard"
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <Home className="h-4 w-4 mr-1" />
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? "border-purple-500 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        {activeTab === "overview" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              System Overview
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Building className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Auctions
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalAuctions}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Ship className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Terminals
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalTerminals}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Globe className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Destinations
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalDestinations}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Clients</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalClients}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Settings className="h-8 w-8 text-indigo-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Services
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalServices}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Car className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Vehicles
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalVehicles}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700">
                  <p className="font-medium mb-1">Admin Setup Notice</p>
                  <p>
                    Remember to delete the admin setup page at{" "}
                    <code>/admin-setup</code> for security once you've created
                    your admin account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "auctions" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Auctions Management
              </h2>
              <button
                onClick={() => openForm("auction")}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Auction
              </button>
            </div>

            <div className="bg-white shadow overflow-hidden rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Postal Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auctions.map((auction) => (
                    <tr key={auction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {auction.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {auction.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {auction.address || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {auction.postal_code || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900 mr-4">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-900">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {auctions.length === 0 && (
                <div className="text-center py-12">
                  <Building className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No auctions
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating a new auction.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Similar sections for other tabs... */}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Add New {formType.charAt(0).toUpperCase() + formType.slice(1)}
              </h3>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                {formType === "auction" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.location || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, location: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address
                      </label>
                      <textarea
                        value={formData.address || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={formData.postal_code || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            postal_code: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainComponent;
