import { useEffect, useState } from "react"
import { CheckCircle2, ShieldCheck, TrendingUp } from "lucide-react"
import api from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"

// Admin-managed "Login Growth" content (Admin > Pages & Social Media > Login Growth Settings).
// One shared fetch is reused by every login page in the session.
let growthRequest = null
const loadGrowthData = () => {
  if (!growthRequest) {
    growthRequest = api
      .get(`${API_ENDPOINTS.ADMIN.LOGIN_GROWTH_PUBLIC}?role=all`)
      .then((res) => (res?.data?.success ? res.data.data || null : null))
      .catch(() => {
        growthRequest = null
        return null
      })
  }
  return growthRequest
}

const asList = (value) => (Array.isArray(value) ? value.filter(Boolean) : [])

const BenefitList = ({ items }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
    {items.map((item, i) => (
      <div key={`${item}-${i}`} className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
        <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium">{item}</span>
      </div>
    ))}
  </div>
)

const Stat = ({ label, value, tone = "text-slate-900 dark:text-white" }) => (
  <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3">
    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block mb-1">{label}</span>
    <span className={`text-sm sm:text-base font-black ${tone}`}>{value}</span>
  </div>
)

const RestaurantExtras = ({ data }) => (
  <>
    {data.savingsExample && (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>Example order value</span>
          <span className="text-slate-900 dark:text-white">₹{data.savingsExample.orderValue || 500}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Traditional apps" value={data.savingsExample.traditionalCommission} tone="text-red-500" />
          <Stat label="Itzo" value={data.savingsExample.itzoCommission} tone="text-emerald-600" />
        </div>
        {data.savingsExample.keepsRevenueText && (
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            {data.savingsExample.keepsRevenueText}
          </p>
        )}
      </div>
    )}
    {(data.additionalMessaging?.monthlyProfit || data.additionalMessaging?.yearlyProfit) && (
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Est. monthly extra profit" value={data.additionalMessaging.monthlyProfit} />
        <Stat label="Est. yearly extra profit" value={data.additionalMessaging.yearlyProfit} />
      </div>
    )}
    {asList(data.consultingServices).length > 0 && (
      <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3">
        <ShieldCheck className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
          Need help registering your business? We assist with {asList(data.consultingServices).join(", ")}.
        </p>
      </div>
    )}
  </>
)

const DeliveryExtras = ({ data }) => (
  <>
    {asList(data.partnerWelfare).length > 0 && (
      <div className="space-y-2">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner welfare</h4>
        <BenefitList items={asList(data.partnerWelfare)} />
      </div>
    )}
    {asList(data.operationalBenefits).length > 0 && (
      <div className="space-y-2">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational benefits</h4>
        <BenefitList items={asList(data.operationalBenefits)} />
      </div>
    )}
    {data.driverMarketingBanner && (
      <p className="text-center text-sm font-black text-slate-900 dark:text-white tracking-wide">{data.driverMarketingBanner}</p>
    )}
    {data.ctaText && <p className="text-center text-xs font-semibold text-slate-500">{data.ctaText}</p>}
  </>
)

const UserExtras = ({ data }) => (
  <>
    {(data.comparison?.traditionalAppsText || data.comparison?.itzoFoodText) && (
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Traditional apps" value={data.comparison.traditionalAppsText} tone="text-red-500" />
        <Stat label="Itzo" value={data.comparison.itzoFoodText} tone="text-emerald-600" />
      </div>
    )}
    {asList(data.keyAdvantages).length > 0 && (
      <div className="space-y-2">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key advantages</h4>
        <BenefitList items={asList(data.keyAdvantages)} />
      </div>
    )}
    {data.privacyMessage && (
      <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3">
        <ShieldCheck className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{data.privacyMessage}</p>
      </div>
    )}
  </>
)

const EXTRAS = { restaurant: RestaurantExtras, delivery: DeliveryExtras, user: UserExtras }

/**
 * Renders the admin-managed growth/benefit content for a login page.
 * @param {"restaurant"|"delivery"|"user"} role
 */
export default function LoginGrowthPanel({ role, className = "" }) {
  const [growth, setGrowth] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadGrowthData().then((data) => {
      if (!cancelled) setGrowth(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const data = growth?.[role]
  if (!data || !data.headline) return null

  const Extras = EXTRAS[role]
  const benefits = asList(data.benefits)
  const images = [data.benefitImage1, data.benefitImage2].filter(Boolean)

  return (
    <section className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0">
          <TrendingUp className="h-4 w-4 text-slate-700" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug">{data.headline}</h3>
          {data.subheadline && <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">{data.subheadline}</p>}
        </div>
      </div>

      {benefits.length > 0 && <BenefitList items={benefits} />}
      {Extras && <Extras data={data} />}

      {images.length > 0 && (
        <div className="flex flex-col gap-3">
          {images.map((src, i) => (
            <div key={src} className="w-full rounded-2xl overflow-hidden border border-slate-100 bg-white flex items-center justify-center">
              <img src={src} alt={`Benefit ${i + 1}`} loading="lazy" className="w-full max-h-[220px] object-contain block" />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
