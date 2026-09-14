import { useEffect, useState } from "react"
import apiClient from "@/services/api/axios"

export default function QuickCommerceVendors() {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const res = await apiClient.get("/quick-commerce/admin/vendors", { contextModule: "admin" })
        setVendors(res?.data?.result || [])
      } catch {
        setVendors([])
      } finally {
        setLoading(false)
      }
    }

    loadVendors()
  }, [])

  return (
    <div className="px-4 py-4 lg:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h1 className="text-xl font-black tracking-tight text-slate-900">Quick Commerce Vendors</h1>
          <p className="text-sm text-slate-500">Store partners configured for quick-commerce.</p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>Loading vendors...</td>
                </tr>
              )}
              {!loading && vendors.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>No vendors found.</td>
                </tr>
              )}
              {!loading && vendors.map((vendor) => (
                <tr key={vendor.id || vendor._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">{vendor.name || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{vendor.phone || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{vendor.city || vendor.address?.city || "-"}</td>
                  <td className="px-4 py-3 uppercase text-xs font-semibold text-emerald-700">{vendor.status || "active"}</td>
                  <td className="px-4 py-3 text-slate-600">{vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
