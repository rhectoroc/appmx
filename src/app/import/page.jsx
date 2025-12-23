import { useState, useRef, useEffect } from "react";
import useUser from "@/utils/useUser";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Home,
  Users,
} from "lucide-react";

function MainComponent() {
  const { data: user, loading: userLoading } = useUser();
  const [userRole, setUserRole] = useState(null);
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [validationResults, setValidationResults] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setValidationResults(null);
    setImportResults(null);

    // Parse CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        setError("CSV file must contain at least a header and one data row");
        return;
      }

      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/"/g, ""));
      const data = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        return row;
      });

      setCsvData(data);
    };
    reader.readAsText(selectedFile);
  };

  const validateData = async () => {
    if (csvData.length === 0) {
      setError("No data to validate");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/import/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicles: csvData,
          validateOnly: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Validation failed");
      }

      setValidationResults(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const importData = async () => {
    if (!validationResults || !validationResults.valid) {
      setError("Please fix validation errors before importing");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/import/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicles: csvData,
          validateOnly: false,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      setImportResults(result);
      setValidationResults(null);
      setCsvData([]);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `vin,client_email,description,auction_name,purchase_price,purchase_date,current_status
12345678901234567,client@example.com,Sample Vehicle,Sample Auction,25000,2024-01-15,purchased
98765432109876543,another@example.com,Another Vehicle,Another Auction,30000,2024-01-16,in_transit`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "vehicle_import_template.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to import data</p>
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
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            You need administrator privileges to import data
          </p>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Upload className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Data Import</h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.name || user.email}
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            Vehicle Import Instructions
          </h2>
          <div className="text-sm text-blue-800 space-y-2">
            <p>• Use the CSV template for proper formatting</p>
            <p>• VIN must be exactly 17 characters</p>
            <p>• Client email must match existing clients in the system</p>
            <p>• Purchase date format: YYYY-MM-DD</p>
            <p>• Status options: purchased, in_transit, completed</p>
            <p>• Auction name must match existing auctions (optional)</p>
          </div>
        </div>

        {/* Download Template */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Step 1: Download Template
          </h3>
          <p className="text-gray-600 mb-4">
            Download the CSV template to ensure your data is formatted
            correctly.
          </p>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </button>
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Step 2: Upload CSV File
          </h3>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <div className="text-sm text-gray-600 mb-4">
              Select a CSV file to import vehicle data
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csvFile"
            />

            <label
              htmlFor="csvFile"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </label>

            {file && (
              <div className="mt-4 text-sm text-gray-600">
                Selected: {file.name} ({csvData.length} rows)
              </div>
            )}
          </div>
        </div>

        {/* Validation */}
        {csvData.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Step 3: Validate Data
            </h3>

            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Found {csvData.length} records in the CSV file.
              </p>

              <button
                onClick={validateData}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Validate Data
                  </>
                )}
              </button>
            </div>

            {validationResults && (
              <div className="border rounded-lg p-4">
                {validationResults.valid ? (
                  <div className="text-green-700">
                    <CheckCircle className="h-5 w-5 inline mr-2" />
                    All {validationResults.validCount} records are valid and
                    ready to import!
                  </div>
                ) : (
                  <div>
                    <div className="text-red-700 mb-4">
                      <AlertCircle className="h-5 w-5 inline mr-2" />
                      Found {validationResults.errorCount} validation errors:
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {validationResults.errors.map((error, index) => (
                        <div
                          key={index}
                          className="bg-red-50 border border-red-200 rounded p-3"
                        >
                          <div className="text-sm font-medium text-red-800">
                            Row {error.row}: {error.vin}
                          </div>
                          <ul className="text-sm text-red-700 mt-1">
                            {error.errors.map((err, idx) => (
                              <li key={idx}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Import */}
        {validationResults && validationResults.valid && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Step 4: Import Data
            </h3>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
              <div className="text-yellow-800 text-sm">
                <strong>Warning:</strong> This will permanently add{" "}
                {validationResults.validCount} vehicles to the database. This
                action cannot be undone.
              </div>
            </div>

            <button
              onClick={importData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Import {validationResults.validCount} Vehicles
                </>
              )}
            </button>
          </div>
        )}

        {/* Import Results */}
        {importResults && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Import Results
            </h3>

            {importResults.success ? (
              <div className="text-green-700">
                <CheckCircle className="h-5 w-5 inline mr-2" />
                Successfully imported {importResults.importedCount} vehicles!
                {importResults.errors && importResults.errors.length > 0 && (
                  <div className="mt-4 text-red-700">
                    <p className="font-medium">Some records had issues:</p>
                    <ul className="mt-2 space-y-1">
                      {importResults.errors.map((error, index) => (
                        <li key={index} className="text-sm">
                          • {error.vin}: {error.errors.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-700">
                <AlertCircle className="h-5 w-5 inline mr-2" />
                Import failed: {importResults.error || "Unknown error"}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default MainComponent;
