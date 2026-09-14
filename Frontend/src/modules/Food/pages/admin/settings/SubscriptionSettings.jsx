import { useState } from "react";

export default function SubscriptionSettings() {
  const [freeTrialOn, setFreeTrialOn] = useState(true);
  const [freeTrialPeriod, setFreeTrialPeriod] = useState("7");
  const [freeTrialUnit, setFreeTrialUnit] = useState("Day");

  const [warningDays, setWarningDays] = useState("5");
  const [warningMessage, setWarningMessage] = useState(
    "Your subscription ending soon. Please renew to continue access."
  );

  const [returnUsage, setReturnUsage] = useState("80");

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span role="img" aria-label="subscription settings">
            ⚙️
          </span>
          <span>Subscription Settings</span>
        </h1>
      </div>

      <div className="space-y-4">
        {/* Offer Free Trial */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Offer Free Trial
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                You can offer vendors a free trial to experience the system
                overall
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-700">Status:</span>
              <ToggleSwitch
                enabled={freeTrialOn}
                onToggle={() => setFreeTrialOn((p) => !p)}
              />
            </div>
          </div>

          <div className="px-5 py-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full md:w-auto">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Free Trial Period
              </label>
              <input
                type="number"
                min={0}
                value={freeTrialPeriod}
                onChange={(e) => setFreeTrialPeriod(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="w-full md:w-48">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                &nbsp;
              </label>
              <div className="relative">
                <select
                  value={freeTrialUnit}
                  onChange={(e) => setFreeTrialUnit(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                >
                  <option>Day</option>
                  <option>Month</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                  ▾
                </span>
              </div>
            </div>

            <div className="w-full md:w-auto md:self-end flex justify-end">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* Show Deadline Warning */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">
              Show Deadline Warning
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Select the number of days before the warning will be shown with a
              countdown to the end of all packages
            </p>
          </div>

          <div className="px-5 py-4 flex flex-col lg:flex-row gap-4">
            <div className="w-full lg:w-1/3">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Days
              </label>
              <input
                type="number"
                min={0}
                value={warningDays}
                onChange={(e) => setWarningDays(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="w-full lg:flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type Message
              </label>
              <input
                type="text"
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="w-full lg:w-auto lg:self-end flex justify-end">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* Return Money Restriction */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">
              Return Money Restriction
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Setup the amount after which if any restaurant change / migrate
              the subscription plan you won&apos;t return any money back
            </p>
          </div>

          <div className="px-5 py-4 flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select subscription usage time (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={returnUsage}
                onChange={(e) => setReturnUsage(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="w-full lg:w-auto lg:self-end flex justify-end">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        enabled ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}
