import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import apiClient from "@/services/api/axios"

export default function QuickCommerceCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await apiClient.get("/quick-commerce/admin/categories", { contextModule: "admin" })
        setCategories(res?.data?.result || [])
      } catch {
        setCategories([])
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [])

  return (
    <div className="px-4 py-4 lg:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">Quick Commerce Categories</h1>
            <p className="text-sm text-slate-500">Manage all category tiles used in quick-commerce.</p>
          </div>
          <Link to="/ecs/quick-commerce/categories/add" className="rounded-xl bg-[#0c831f] px-3 py-2 text-sm font-bold text-white">
            Add Category
          </Link>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          {loading && <div className="p-4 text-sm text-slate-500">Loading categories...</div>}
          {!loading && categories.length === 0 && <div className="p-4 text-sm text-slate-500">No categories found.</div>}
          {!loading && categories.map((category) => (
            <div key={category.id || category._id} className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-3">
                <img src={category.image} alt={category.name} className="h-10 w-10 rounded-lg object-cover" />
                <div>
                  <p className="font-semibold text-slate-900">{category.name}</p>
                  <p className="text-xs text-slate-500">{category.slug || "-"}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600">#{category.sortOrder ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
