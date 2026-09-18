import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import FooterSection from '../components/FooterSection';
import LicensingSupportModal from './LicensingSupportModal';
import { motion, AnimatePresence } from 'framer-motion';
import api from "@food/api";
import { API_ENDPOINTS } from "@food/api/config";
import { useAuth } from "@core/context/AuthContext";
import { 
  Shield, 
  Check, 
  Percent, 
  CreditCard, 
  User, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  ExternalLink, 
  ArrowRight, 
  Phone, 
  Mail, 
  Building, 
  MapPin, 
  CheckCircle,
  HelpCircle,
  Award
} from 'lucide-react';

const defaultConsultingData = {
  heroTitle: 'Restaurant Consulting & Licensing Assistance',
  heroSubtitle: 'Get your restaurant compliant and ready to onboard quickly with our expert assistance.',
  heroBannerImage: '',
  heroCtaText: 'Become a Partner',
  applyFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfk0WaAX2M7r3JNTHKH9W9t6jss2bmi_eo4NSRbQuWu5d4xoQ/viewform?pli=1',
  applyButtonLabel: 'Apply Here',
  documents: [
    { icon: 'CreditCard', title: 'PAN Card', description: 'Permanent Account Number', requirementExplanation: 'Required for tax identity verification.' },
    { icon: 'User', title: 'Aadhaar Card', description: 'UIDAI Aadhaar Number', requirementExplanation: 'Required for identity and address verification.' },
    { icon: 'ShieldCheck', title: 'FSSAI License', description: 'Food Safety License', requirementExplanation: 'Mandatory license from Food Safety and Standards Authority of India.' },
    { icon: 'Percent', title: 'GST License', description: 'Goods and Services Tax Registration', requirementExplanation: 'Mandatory for restaurants with turnover exceeding threshold.' }
  ],
  contentSections: [
    { heading: 'FSSAI Assistance', description: 'Get professional support in applying for New/Renewal FSSAI state or central licenses.' },
    { heading: 'GST Registration Assistance', description: 'Complete your GST registration without hassles through our verified partner networks.' },
    { heading: 'Restaurant Compliance Guidance', description: 'Ensure your kitchen operations and documentation follow government health department rules.' },
    { heading: 'Licensing Consultation', description: 'Speak with our licensing experts to understand what exact licenses are needed for your specific restaurant type.' }
  ],
  vendors: [],
  terms: [
    'Data sharing consent: By submitting, you agree to share your information with our registered consultants.',
    'Consultant assistance disclaimer: The platform acts as a facilitator and does not guarantee license approval.',
    'Pricing disclaimer: Pricing is decided by third-party consultants and may vary based on your state/city.',
    'Service responsibility disclaimer: ItzoFood is not responsible for any delay in service by compliance consultants.',
    'Support process explanation: Once you submit the form, our partner consultants will contact you within 24-48 business hours.',
    'Legal disclaimer: Obtaining licenses is subject to government approvals and documentation validity.'
  ]
};

// Map string icon names to Lucide icons
const iconMap = {
  CreditCard: CreditCard,
  User: User,
  ShieldCheck: Shield,
  Percent: Percent,
  Briefcase: Award,
  Info: HelpCircle
};

export default function RestaurantConsulting() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState(defaultConsultingData);
  const [openAccordion, setOpenAccordion] = useState(null);
  
  // Licensing support modal state
  const [isLicensingModalOpen, setIsLicensingModalOpen] = useState(false);
  const [preFillData, setPreFillData] = useState(null);

  // User/restaurant form state
  const [restaurantName, setRestaurantName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  
  // Document checklists
  const [hasFssai, setHasFssai] = useState(true);
  const [hasGst, setHasGst] = useState(true);
  const [checkedDocs, setCheckedDocs] = useState({
    pan: true,
    aadhaar: true
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchPageData();
  }, []);

  // Pre-fill fields if user is authenticated
  useEffect(() => {
    if (user) {
      setContactName(user.name || '');
      setEmail(user.email || '');
      setMobile(user.mobile || user.phone || '');
    }
  }, [user]);

  const fetchPageData = async () => {
    try {
      setLoading(true);
      // Fetch public consulting page configuration
      const response = await api.get(API_ENDPOINTS.ADMIN.CONSULTING_PUBLIC);
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setPageData({
          heroTitle: data.heroTitle || defaultConsultingData.heroTitle,
          heroSubtitle: data.heroSubtitle || defaultConsultingData.heroSubtitle,
          heroBannerImage: data.heroBannerImage || defaultConsultingData.heroBannerImage,
          heroCtaText: data.heroCtaText || defaultConsultingData.heroCtaText,
          applyFormUrl: data.applyFormUrl || defaultConsultingData.applyFormUrl,
          applyButtonLabel: data.applyButtonLabel || defaultConsultingData.applyButtonLabel,
          documents: Array.isArray(data.documents) && data.documents.length > 0 ? data.documents : defaultConsultingData.documents,
          contentSections: Array.isArray(data.contentSections) && data.contentSections.length > 0 ? data.contentSections : defaultConsultingData.contentSections,
          vendors: Array.isArray(data.vendors) ? data.vendors.filter(v => v.status === 'active') : [],
          terms: Array.isArray(data.terms) && data.terms.length > 0 ? data.terms : defaultConsultingData.terms
        });
      }
    } catch (error) {
      console.error('Error fetching public consulting content:', error);
      // Fallback is already set in state
    } finally {
      setLoading(false);
    }
  };

  const handleInquirySubmit = (e) => {
    e.preventDefault();
    // Pre-fill modal fields using what the user already typed in the hero form
    setPreFillData({
      restaurantName,
      ownerName: contactName,
      city,
      mobile,
      email,
      selectedLicenses: [
        ...(hasFssai ? [] : ['FSSAI License']),
        ...(hasGst ? [] : ['GST Registration'])
      ]
    });
    setIsLicensingModalOpen(true);
  };

  const toggleAccordion = (index) => {
    setOpenAccordion(openAccordion === index ? null : index);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center pt-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto"></div>
            <p className="mt-4 text-slate-600 font-medium">Loading consulting assistance program...</p>
          </div>
        </div>
        <FooterSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">
      <Navbar />

      {/* Hero Section & Top form */}
      <section className="relative pt-28 pb-16 px-4 md:px-8 bg-slate-950 text-white overflow-hidden">
        {/* Decorative background vectors */}
        <div className="absolute inset-0 bg-gradient-to-tr from-rose-950/40 via-slate-950 to-slate-950 opacity-90 z-0"></div>
        {pageData.heroBannerImage && (
          <img 
            src={pageData.heroBannerImage} 
            alt="Hero Background" 
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30 z-0" 
          />
        )}
        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 relative z-10 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold uppercase tracking-wider"
            >
              <Shield className="w-4 h-4" />
              Onboarding & Licensing Support
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-none"
            >
              {pageData.heroTitle}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-slate-300 max-w-xl leading-relaxed"
            >
              {pageData.heroSubtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-6 pt-4 text-xs text-slate-400 font-semibold"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                100% Compliant Onboarding
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                Verified Consultants
              </div>
            </motion.div>
          </div>

          {/* Right Interactive Form Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-5 bg-white text-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-100"
          >
            <h3 className="text-xl font-extrabold text-slate-950 mb-2">Get Started</h3>
            <p className="text-sm text-slate-500 mb-6">Enter details and apply for consulting or missing licenses copy.</p>

            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase">Restaurant Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Building className="w-4 h-4" /></span>
                  <input
                    type="text"
                    required
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="Enter Restaurant Name"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">Contact Person</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">City</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><MapPin className="w-4 h-4" /></span>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">Mobile Number</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Phone className="w-4 h-4" /></span>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10 digit number"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">Email ID</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Mail className="w-4 h-4" /></span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@restaurant.com"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Fast License check */}
              <div className="pt-2 border-t border-slate-100 space-y-3 text-xs text-slate-700">
                <div className="font-bold uppercase text-slate-800">Check existing licenses:</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={hasFssai} 
                      onChange={(e) => setHasFssai(e.target.checked)}
                      className="accent-rose-500" 
                    />
                    <span>FSSAI License</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={hasGst} 
                      onChange={(e) => setHasGst(e.target.checked)}
                      className="accent-rose-500" 
                    />
                    <span>GSTIN License</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <span>{pageData.heroCtaText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>

        </div>
      </section>

      {/* Required Documents Section */}
      <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12 max-w-3xl mx-auto space-y-3">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950">Documents Checklist</h2>
          <p className="text-slate-600 text-base">Keep these key documents handy for a fast, frictionless onboarding and compliance verification process.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pageData.documents.map((doc, idx) => {
            const IconComp = iconMap[doc.icon] || Shield;
            const isFssai = doc.title?.toLowerCase().includes('fssai');
            const isGst = doc.title?.toLowerCase().includes('gst');
            
            // Highlight action if the user has unchecked that they have them in the hero form
            const showApplyCta = (isFssai && !hasFssai) || (isGst && !hasGst);

            return (
              <motion.div
                key={idx}
                whileHover={{ y: -5 }}
                className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between ${
                  showApplyCta ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-150 hover:shadow-xl'
                }`}
              >
                <div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-5 ${
                    showApplyCta ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-700'
                  }`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center justify-between">
                    {doc.title}
                    {showApplyCta && (
                      <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold uppercase">Missing</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">{doc.description}</p>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">{doc.requirementExplanation}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-400">
                    Status: <span className={showApplyCta ? "text-rose-500" : "text-green-600"}>{showApplyCta ? "Not Available" : "Required"}</span>
                  </div>
                  {(isFssai || isGst) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreFillData({
                          selectedLicenses: [isFssai ? 'FSSAI License' : 'GST Registration']
                        });
                        setIsLicensingModalOpen(true);
                      }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                        showApplyCta 
                          ? "bg-rose-500 text-white shadow-sm hover:bg-rose-600" 
                          : "text-rose-500 hover:bg-rose-50"
                      }`}
                    >
                      <span>{pageData.applyButtonLabel}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Consulting Services Information Sections */}
      <section className="bg-slate-100/60 py-20 px-4 md:px-8 border-t border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950">Why Professional Consulting Support?</h2>
            <p className="text-slate-600 text-base">Platform requirements and government regulations can be complicated. Our partners help you accelerate setup time.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {pageData.contentSections.map((sec, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/60 flex items-start gap-4 hover:shadow-lg transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center font-bold text-xs shrink-0">
                  {idx + 1}
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">{sec.heading}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{sec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Partners / Vendors Section */}
      {pageData.vendors && pageData.vendors.length > 0 && (
        <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto w-full">
          <div className="text-center mb-16 max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950">Verified Compliance Consultants</h2>
            <p className="text-slate-600 text-base">Directly connect with certified agencies specialized in FSSAI licenses, GST, and trade registrations.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pageData.vendors.map((vendor, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.01 }}
                className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-xl transition-all flex flex-col justify-between"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    {vendor.logo ? (
                      <img src={vendor.logo} alt={vendor.name} className="w-14 h-14 object-contain rounded-xl border p-1 bg-slate-50" />
                    ) : (
                      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs">CS</div>
                    )}
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{vendor.name}</h3>
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase inline-block mt-1">Verified Partner</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-600 leading-relaxed">{vendor.description}</p>

                  <div className="space-y-2 pt-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Services:</span>
                      <span className="font-bold text-slate-800 text-right">{vendor.services}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pricing Info:</span>
                      <span className="font-bold text-rose-500">{vendor.pricingInfo}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Details</span>
                  <a
                    href={`mailto:${vendor.contactDetails}`}
                    className="text-xs bg-slate-900 hover:bg-black text-white font-bold py-2 px-4 rounded-xl transition-all"
                  >
                    Send Inquiry
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Disclaimers & Terms Accordion */}
      <section className="py-20 px-4 md:px-8 max-w-4xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">Terms & Compliance Guidelines</h2>
          <p className="text-slate-500 text-sm mt-2">Legal policies regarding consultant handoffs and service limitations.</p>
        </div>

        <div className="space-y-4">
          {pageData.terms.map((term, idx) => {
            const splitIndex = term.indexOf(':');
            const title = splitIndex !== -1 ? term.substring(0, splitIndex).trim() : `Disclaimer #${idx + 1}`;
            const content = splitIndex !== -1 ? term.substring(splitIndex + 1).trim() : term;

            return (
              <div 
                key={idx} 
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => toggleAccordion(idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left font-bold text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <span className="capitalize">{title}</span>
                  {openAccordion === idx ? (
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                  )}
                </button>
                
                <AnimatePresence initial={false}>
                  {openAccordion === idx && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                        {content}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA block */}
      <section className="py-16 px-4 md:px-8 max-w-5xl mx-auto w-full text-center">
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-[36px] p-8 md:p-14 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">Ready to launch your restaurant on ItzoFood?</h2>
          <p className="text-rose-100 text-base md:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            Get 30% more orders by partner onboarding. Reach thousands of local foodies today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <a 
              href="/food/restaurant" 
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-rose-600 font-extrabold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all text-base tracking-wide flex items-center justify-center gap-2"
            >
              <span>Register Restaurant</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <button 
              type="button"
              onClick={() => {
                setPreFillData(null);
                setIsLicensingModalOpen(true);
              }}
              className="w-full sm:w-auto bg-rose-700/40 hover:bg-rose-700/60 border border-white/20 text-white font-extrabold py-4 px-8 rounded-full transition-all text-base tracking-wide flex items-center justify-center gap-2"
            >
              <span>{pageData.applyButtonLabel}</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <FooterSection />
      
      <LicensingSupportModal 
        isOpen={isLicensingModalOpen} 
        onClose={() => setIsLicensingModalOpen(false)} 
        preFillData={preFillData} 
      />
    </div>
  );
}
