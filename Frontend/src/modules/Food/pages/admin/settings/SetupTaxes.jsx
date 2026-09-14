import { useState } from "react";

export default function SetupTaxes() {
  const [statusOn, setStatusOn] = useState(true);
  const [productPriceMode, setProductPriceMode] = useState("exclude");
  const [taxType, setTaxType] = useState("order-wise");
  const [taxRate, setTaxRate] = useState("custom-10");
  const [packagingTaxOn, setPackagingTaxOn] = useState(true);

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
          Setup Tax Calculation
        </h1>
      </div>

      <div className="space-y-4">
        {/* Allow Tax calculation card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Allow Tax Calculation For Restaurant ?
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                To active tax calculation Turn On The Status.
              </p>
            </div>
            <ToggleSwitch enabled={statusOn} onToggle={() => setStatusOn((p) => !p)} />
          </div>

          {/* Tax based on product price */}
          <div className="px-4 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Tax calculation based on Product Price
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
              <label className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                <input
                  type="radio"
                  name="price-mode"
                  checked={productPriceMode === "include"}
                  onChange={() => setProductPriceMode("include")}
                  className="mt-1 w-3.5 h-3.5 text-blue-600"
                />
                <div>
                  <p className="font-semibold text-slate-900 mb-0.5">
                    Calculate Tax Include Product Price
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    By selecting this option no need to setup VAT from here. If
                    enabled the customer will see the total food price
                    including VAT.
                  </p>
                </div>
              </label>

              <label className="flex gap-3 rounded-lg border border-blue-500 bg-blue-50 px-4 py-3 cursor-pointer">
                <input
                  type="radio"
                  name="price-mode"
                  checked={productPriceMode === "exclude"}
                  onChange={() => setProductPriceMode("exclude")}
                  className="mt-1 w-3.5 h-3.5 text-blue-600"
                />
                <div>
                  <p className="font-semibold text-slate-900 mb-0.5">
                    Calculate Tax Exclude Product Price
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    By selecting this option you will need to setup individual
                    vat rate for different types of income source.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Basic setup */}
          <div className="px-4 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Basic Setup
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Select Tax Type
                </label>
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="order-wise">Order wise</option>
                  <option value="item-wise">Item wise</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Select Tax Rate
                </label>
                <div className="relative">
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="custom-10">Custom Tax (10%)</option>
                    <option value="gst-15">GST (15%)</option>
                    <option value="income-5">Income Tax (5%)</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                    ▾
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional setup */}
          <div className="px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Additional Setup
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Tax on packaging charge
                </label>
                <ToggleSwitch
                  enabled={packagingTaxOn}
                  onToggle={() => setPackagingTaxOn((p) => !p)}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  &nbsp;
                </label>
                <div className="relative">
                  <select
                    value="gst-15"
                    readOnly
                    className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option>GST (15%)</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                    ▾
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Save Information
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center w-11 h-6 rounded-full border transition-all ${enabled
        ? "bg-blue-600 border-blue-600 justify-end"
        : "bg-slate-200 border-slate-300 justify-start"
        }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}
