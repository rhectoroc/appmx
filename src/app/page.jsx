import { useEffect } from "react";
import useUser from "@/utils/useUser";
import { Car } from "lucide-react";

function MainComponent() {
  const { data: user, loading } = useUser();

  useEffect(() => {
    if (!loading && user) {
      // Redirect authenticated users to dashboard
      window.location.href = "/dashboard";
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex justify-center mb-6">
              <Car className="h-16 w-16 text-blue-600" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">MotorX</h1>
            <p className="text-gray-600 mb-8">
              CRM and Integral Vehicle Management System
            </p>

            <div className="space-y-4">
              <a
                href="/account/signin"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Sign In
              </a>

              <p className="text-sm text-gray-500">
                Need an account? Contact your administrator
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-blue-100 text-sm">
              Centralized management of clients, sub-clients, vehicles, services
              and pricing
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainComponent;
