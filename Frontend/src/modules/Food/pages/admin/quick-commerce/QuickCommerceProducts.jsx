import { useEffect, useMemo, useState } from "react"
import apiClient from "@/services/api/axios"

const formatMoney = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`

export default function QuickCommerceProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          apiClient.get("/quick-commerce/admin/products", { contextModule: "admin" }),
          apiClient.get("/quick-commerce/admin/categories", { contextModule: "admin" }),
        ])

        setProducts(productsRes?.data?.result || [])
        setCategories(categoriesRes?.data?.result || [])
      } catch {
        setProducts([])
        setCategories([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const categoryById = useMemo(() => {
    const map = {}
    categories.forEach((category) => {
      map[String(category.id || category._id)] = category.name
    })
    return map
  }, [categories])

  return (
    <div className="px-4 py-4 lg:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h1 className="text-xl font-black tracking-tight text-slate-900">Quick Commerce Products</h1>
          <p className="text-sm text-slate-500">All catalog products from quick-commerce admin API.</p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">MRP</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Badge</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>Loading products...</td>
                </tr>
              )}
              {!loading && products.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>No products found.</td>
                </tr>
              )}
              {!loading && products.map((product) => (
                <tr key={product.id || product._id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-9 w-9 rounded-lg object-cover"
                      />
                      <div>
                        <p className="font-semibold text-slate-900">{product.name || "-"}</p>
                        <p className="text-xs text-slate-500">{product.slug || "-"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {categoryById[String(product.categoryId)] || "-"}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">{formatMoney(product.price)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatMoney(product.mrp)}</td>
                  <td className="px-4 py-3 text-slate-700">{product.unit || "-"}</td>
                  <td className="px-4 py-3 text-xs font-semibold uppercase text-emerald-700">{product.badge || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
