import { useEffect, useMemo, useState } from 'react';
import { Package, ShoppingBag, Tags, IndianRupee, Plus } from 'lucide-react';
import apiClient from '@/services/api/axios';

const money = (n) => `?${Number(n || 0).toLocaleString('en-IN')}`;

const initialCategoryForm = {
  name: '',
  image: '',
  accentColor: '#0c831f',
  sortOrder: 0,
};

const initialProductForm = {
  name: '',
  image: '',
  categoryId: '',
  price: '',
  mrp: '',
  unit: '',
  badge: '',
};

function StatCard({ title, value, icon, tone }) {
  return (
    <div className={`rounded-2xl border ${tone} bg-white p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{title}</p>
        <div className="rounded-xl bg-slate-100 p-2">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

export default function QuickCommerceAdminDashboard() {
  const [stats, setStats] = useState({ categories: 0, products: 0, orders: 0, revenue: 0 });
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [loading, setLoading] = useState(true);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, categoriesRes, productsRes, ordersRes] = await Promise.all([
        apiClient.get('/quick-commerce/admin/stats', { contextModule: 'admin' }),
        apiClient.get('/quick-commerce/admin/categories', { contextModule: 'admin' }),
        apiClient.get('/quick-commerce/admin/products', { contextModule: 'admin' }),
        apiClient.get('/quick-commerce/admin/orders', { contextModule: 'admin' }),
      ]);

      setStats(statsRes.data?.result || { categories: 0, products: 0, orders: 0, revenue: 0 });
      setCategories(categoriesRes.data?.result || []);
      setProducts(productsRes.data?.result || []);
      setOrders(ordersRes.data?.result || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const categoryMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => {
      m[String(c.id || c._id)] = c;
    });
    return m;
  }, [categories]);

  const submitCategory = async (e) => {
    e.preventDefault();
    setSubmittingCategory(true);
    try {
      await apiClient.post('/quick-commerce/admin/categories', categoryForm, { contextModule: 'admin' });
      setCategoryForm(initialCategoryForm);
      await load();
    } finally {
      setSubmittingCategory(false);
    }
  };

  const submitProduct = async (e) => {
    e.preventDefault();
    setSubmittingProduct(true);
    try {
      await apiClient.post('/quick-commerce/admin/products', {
        ...productForm,
        price: Number(productForm.price || 0),
        mrp: Number(productForm.mrp || productForm.price || 0),
      }, { contextModule: 'admin' });
      setProductForm(initialProductForm);
      await load();
    } finally {
      setSubmittingProduct(false);
    }
  };

  return (
    <div className="px-4 py-4 lg:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#0c831f]">Quick Commerce</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Blinkit-style Admin Dashboard</h1>
            <p className="text-sm text-slate-500">Connected to `/api/v1/quick-commerce/admin/*` APIs.</p>
          </div>
          <button onClick={() => load()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Refresh</button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Categories" value={stats.categories} icon={<Tags className="h-4 w-4 text-emerald-700" />} tone="border-emerald-100" />
            <StatCard title="Products" value={stats.products} icon={<Package className="h-4 w-4 text-[#460d8b]" />} tone="border-[#f0e7f9]" />
            <StatCard title="Orders" value={stats.orders} icon={<ShoppingBag className="h-4 w-4 text-amber-700" />} tone="border-amber-100" />
            <StatCard title="Revenue" value={money(stats.revenue)} icon={<IndianRupee className="h-4 w-4 text-[#460d8b]" />} tone="border-[#f0e7f9]" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <form onSubmit={submitCategory} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Add Category</h2>
              <div className="mt-3 space-y-2">
                <input required value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} placeholder="Category name" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <input required value={categoryForm.image} onChange={(e) => setCategoryForm((p) => ({ ...p, image: e.target.value }))} placeholder="Image URL" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={categoryForm.accentColor} onChange={(e) => setCategoryForm((p) => ({ ...p, accentColor: e.target.value }))} placeholder="#0c831f" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  <input type="number" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm((p) => ({ ...p, sortOrder: e.target.value }))} placeholder="Sort order" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
                <button disabled={submittingCategory} className="inline-flex items-center gap-2 rounded-xl bg-[#0c831f] px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
                  <Plus className="h-4 w-4" /> {submittingCategory ? 'Saving...' : 'Create Category'}
                </button>
              </div>
            </form>

            <form onSubmit={submitProduct} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Add Product</h2>
              <div className="mt-3 space-y-2">
                <input required value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} placeholder="Product name" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <input required value={productForm.image} onChange={(e) => setProductForm((p) => ({ ...p, image: e.target.value }))} placeholder="Image URL" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <select required value={productForm.categoryId} onChange={(e) => setProductForm((p) => ({ ...p, categoryId: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category.id || category._id} value={category.id || category._id}>{category.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input required type="number" min="0" value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))} placeholder="Price" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  <input type="number" min="0" value={productForm.mrp} onChange={(e) => setProductForm((p) => ({ ...p, mrp: e.target.value }))} placeholder="MRP" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={productForm.unit} onChange={(e) => setProductForm((p) => ({ ...p, unit: e.target.value }))} placeholder="Unit (500 ml)" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  <input value={productForm.badge} onChange={(e) => setProductForm((p) => ({ ...p, badge: e.target.value }))} placeholder="Badge" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
                <button disabled={submittingProduct} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
                  <Plus className="h-4 w-4" /> {submittingProduct ? 'Saving...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-700">Categories ({categories.length})</div>
              <div className="max-h-72 overflow-auto">
                {loading ? <div className="p-4 text-sm text-slate-500">Loading...</div> : categories.map((category) => (
                  <div key={category.id || category._id} className="flex items-center justify-between border-b border-slate-50 px-4 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <img src={category.image} alt={category.name} className="h-9 w-9 rounded-lg object-cover" />
                      <div>
                        <p className="font-bold text-slate-900">{category.name}</p>
                        <p className="text-xs text-slate-500">{category.slug}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">#{category.sortOrder}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-700">Recent Orders ({orders.length})</div>
              <div className="max-h-72 overflow-auto">
                {loading ? <div className="p-4 text-sm text-slate-500">Loading...</div> : orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between border-b border-slate-50 px-4 py-2 text-sm">
                    <div>
                      <p className="font-bold text-slate-900">{order.orderNumber}</p>
                      <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">{money(order.total)}</p>
                      <p className="text-xs uppercase text-emerald-700">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-700">Products ({products.length})</div>
            <div className="overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Price</th>
                    <th className="px-4 py-2">MRP</th>
                    <th className="px-4 py-2">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id || product._id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <img src={product.image} alt={product.name} className="h-9 w-9 rounded-lg object-cover" />
                          <div>
                            <p className="font-semibold text-slate-900">{product.name}</p>
                            <p className="text-xs text-slate-500">{product.badge || 'No badge'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-slate-700">{categoryMap[String(product.categoryId)]?.name || 'Unknown'}</td>
                      <td className="px-4 py-2 font-bold text-slate-900">{money(product.price)}</td>
                      <td className="px-4 py-2 text-slate-600">{money(product.mrp)}</td>
                      <td className="px-4 py-2 text-slate-600">{product.unit || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
