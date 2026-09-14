import { ChevronLeft, LogOut, Sparkles, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import loginBg from "@food/assets/loginbanner.png"
import {
  OnboardingProgressBarHorizontal,
  OnboardingProgressBarVertical,
} from "./OnboardingProgressBar"
import { ONBOARDING_STEPS } from "./onboardingStyles"
import AuthCircleLogo from "@shared/components/AuthCircleLogo"

export default function RestaurantOnboardingShell({
  step,
  companyName,
  bannerUrl,
  logoUrl,
  loading,
  saving,
  error,
  keyboardInset,
  isEditing,
  isLoggingOut,
  requiresOnboardingFee,
  feeConfig,
  onBack,
  onLogout,
  onEnableEdit,
  onNext,
  children,
}) {
  const activeStep = ONBOARDING_STEPS.find((s) => s.id === step)
  const isLastStep = step === 4

  const continueLabel = isLastStep
    ? saving
      ? "Saving..."
      : requiresOnboardingFee
        ? `Pay ₹${Number(feeConfig?.price || 0).toLocaleString("en-IN")} & Finish`
        : "Finish"
    : saving
      ? "Saving..."
      : "Continue"

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans">
      {/* Desktop sidebar — fixed, does not scroll with page */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[420px] flex-col xl:w-[460px] lg:flex">
        <img
          src={bannerUrl || loginBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#FF0000]/95 via-[#E64D02]/90 to-[#B91C1C]/95" />

        <div className="relative z-10 flex h-full flex-col overflow-hidden p-8 xl:p-10">
          <div className="shrink-0">
            <div className="flex items-center gap-3">
              <AuthCircleLogo
                src={logoUrl}
                alt={`${companyName} logo`}
                fallbackText={companyName}
                className="h-12 w-12 shadow-lg"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                  Partner Onboarding
                </p>
                <p className="text-lg font-black text-white">{companyName}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/20 bg-white/15 p-5 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">Current step</p>
              <p className="mt-1 text-xl font-black text-white">{activeStep?.title}</p>
              <p className="mt-1 text-sm text-white/80">{activeStep?.subtitle}</p>
            </div>
          </div>

          <div className="mt-6 shrink-0 px-1">
            <OnboardingProgressBarVertical currentStep={step} />
          </div>
        </div>
      </aside>

      {/* Main content — offset for fixed sidebar on desktop */}
      <div className="flex min-h-screen min-w-0 flex-col lg:ml-[420px] lg:h-screen lg:overflow-hidden xl:ml-[460px]">
        {/* Mobile header */}
        <header className="sticky top-0 z-40 border-b border-slate-100 bg-white lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000]/30"
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-serif font-bold text-gray-900 tracking-wide">Restaurant Onboarding</p>
                <p className="truncate text-[11px] font-medium text-slate-500">{activeStep?.title}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!loading && !isEditing && (
                <Button
                  type="button"
                  onClick={onEnableEdit}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer border-[#FF0000]/20 bg-[#FF0000]/5 text-[#FF0000] hover:bg-[#FF0000]/10"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              <Button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut}
                variant="ghost"
                size="icon"
                className="h-10 w-10 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-6">
            <OnboardingProgressBarHorizontal currentStep={step} />
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden shrink-0 items-center justify-between border-b border-slate-100 bg-white px-8 py-5 lg:flex xl:px-10">
          <div className="flex items-center gap-4">
            {step > 1 && (
              <button
                type="button"
                onClick={onBack}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000]/30"
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                Step {step} of {ONBOARDING_STEPS.length}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                {activeStep?.title}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{activeStep?.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!loading && !isEditing && (
              <Button
                type="button"
                onClick={onEnableEdit}
                variant="outline"
                className="cursor-pointer border-[#FF0000]/20 bg-[#FF0000]/5 text-[#FF0000] hover:bg-[#FF0000]/10"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Edit Details
              </Button>
            )}
            <Button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              variant="outline"
              className="cursor-pointer border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Exit
            </Button>
          </div>
        </header>

        <main
          id="onboarding-main-scroll"
          className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 xl:px-10"
          style={{ paddingBottom: keyboardInset ? `${keyboardInset + 20}px` : undefined }}
        >
          <div className="mx-auto w-full max-w-3xl">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#FF0000]" />
                <p className="text-sm font-medium text-slate-500">Loading your onboarding details...</p>
              </div>
            ) : (
              <div className={!isEditing ? "pointer-events-none select-none opacity-95" : ""}>
                {children}
              </div>
            )}
          </div>
        </main>

        {error && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-2 sm:px-6 lg:px-8 xl:px-10">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          </div>
        )}

        <footer
          className={`shrink-0 border-t border-slate-100 bg-white/95 backdrop-blur-md lg:sticky lg:bottom-0 lg:z-30 ${
            keyboardInset ? "hidden" : ""
          }`}
        >
          <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
            <Button
              type="button"
              onClick={onNext}
              disabled={saving || (isLastStep && !isEditing)}
              className={`min-w-[140px] w-full sm:w-auto cursor-pointer rounded-full bg-[#FF0000] px-8 text-sm font-bold text-white shadow-lg shadow-[#FF0000]/20 transition-all hover:bg-[#E64D02] disabled:cursor-not-allowed disabled:opacity-50 ${
                isLastStep && !isEditing ? "opacity-50" : ""
              }`}
            >
              {continueLabel}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
