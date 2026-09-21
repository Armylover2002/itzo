import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineCheckBadge,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineEnvelope,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineShieldCheck,
  HiOutlineTag,
} from 'react-icons/hi2';
import { toast } from 'sonner';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import { formatOpeningHoursAMPM } from '@shared/utils/timeFormat';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const infoValue = (value, fallback = 'Not provided') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && !value.trim()) return fallback;
  return value;
};

const SellerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [seller, setSeller] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSeller = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getSellerRequests({ status: 'approved', limit: 500 });
      const items =
        response?.data?.result?.items ||
        response?.data?.data?.items ||
        response?.data?.result ||
        [];

      const matchedSeller = Array.isArray(items)
        ? items.find((item) => String(item?._id || item?.id) === String(id))
        : null;

      setSeller(matchedSeller || null);

      if (!matchedSeller) {
        toast.error('Approved seller not found');
      }
    } catch (error) {
      setSeller(null);
      toast.error('Failed to load seller details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSeller();
  }, [id]);

  const documentItems = useMemo(() => {
    if (!seller) return [];

    const docs = [
      { label: 'Shop Image', image: seller.shopInfo?.shopImage },
      { label: 'GST Number', value: seller.documents?.gstNumber },
      { label: 'GST Legal Name', value: seller.documents?.gstLegalName },
      { label: 'PAN Number', value: seller.documents?.panNumber },
      { label: 'FSSAI Number', value: seller.documents?.fssaiNumber, expiry: seller.documents?.fssaiExpiry, image: seller.documents?.fssaiImage },
      { label: 'Shop License', value: seller.documents?.shopLicenseNumber, expiry: seller.documents?.shopLicenseExpiry, image: seller.documents?.shopLicenseImage },
    ];
    
    return docs.filter((item) => item.value || item.image);
  }, [seller]);

  const bankItems = useMemo(() => {
    if (!seller?.bankInfo) return [];

    return [
      { label: 'Bank Name', value: seller.bankInfo.bankName },
      { label: 'Account Name', value: seller.bankInfo.accountHolderName },
      { label: 'Account Number', value: seller.bankInfo.accountNumber },
      { label: 'IFSC Code', value: seller.bankInfo.ifscCode },
      { label: 'Account Type', value: seller.bankInfo.accountType },
      { label: 'UPI ID', value: seller.bankInfo.upiId },
    ].filter((item) => item.value);
  }, [seller]);

  const detailCards = useMemo(() => {
    if (!seller) return [];

    return [
      {
        label: 'Business type',
        value: seller.category || seller?.shopInfo?.businessType,
        icon: HiOutlineTag,
      },
      {
        label: 'Service zone',
        value: seller?.shopInfo?.zoneName,
        icon: HiOutlineMapPin,
      },
      {
        label: 'Opening Hours',
        value: seller?.shopInfo?.openingHours ? formatOpeningHoursAMPM(seller.shopInfo.openingHours) : 'Not set',
        icon: HiOutlineClock,
      },
    ];
  }, [seller]);

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/ecs/quick-commerce/sellers/active')}
            className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <HiOutlineArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="ds-h1">Seller Store View</h1>
            <p className="ds-description mt-0.5">
              Quick-commerce store details only, without extra finance or platform data.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadSeller}
          className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white"
        >
          <HiOutlineArrowPath className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <Card className="border-none p-10 text-center shadow-xl ring-1 ring-slate-100">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <HiOutlineArrowPath className="h-10 w-10 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Loading seller store details...</p>
          </div>
        </Card>
      ) : !seller ? (
        <Card className="border-none p-10 text-center shadow-xl ring-1 ring-slate-100">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <HiOutlineBuildingOffice2 className="h-10 w-10" />
            <p className="text-sm font-semibold text-slate-600">This approved seller could not be found.</p>
            <button
              type="button"
              onClick={() => navigate('/ecs/quick-commerce/sellers/active')}
              className="mt-2 rounded-xl bg-purple-600 px-4 py-2 text-[11px] font-bold text-white"
            >
              Back to active sellers
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <Card className="border-none p-6 shadow-xl ring-1 ring-slate-100">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 overflow-hidden shrink-0">
                    {seller.shopInfo?.shopImage ? (
                      <img src={seller.shopInfo.shopImage} alt={seller.shopName || 'Store'} className="h-full w-full object-cover" />
                    ) : (
                      <HiOutlineBuildingOffice2 className="h-8 w-8" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black text-slate-900">
                        {seller.shopName || 'Unnamed store'}
                      </h2>
                      <Badge variant="success" className="text-[10px] font-bold uppercase">
                        {seller.status || 'approved'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Owner: {infoValue(seller.ownerName)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {infoValue(seller.location, 'Store address not added yet')}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                    Approved on
                  </p>
                  <p className="mt-1 text-sm font-bold text-emerald-900">
                    {formatDate(seller.approvedAt || seller.applicationDate)}
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {detailCards.map((item) => (
                <Card key={item.label} className="border-none p-5 shadow-sm ring-1 ring-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="ds-label">{item.label}</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {infoValue(item.value)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="border-none p-6 shadow-xl ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <HiOutlineDocumentText className="h-5 w-5 text-slate-500" />
                <h3 className="text-lg font-black text-slate-900">Store documents</h3>
              </div>

              {documentItems.length ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {documentItems.map((doc) => (
                    <div key={doc.label} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        {doc.label}
                      </p>
                      {(doc.value || !doc.image) && (
                        <p className="mt-1 break-all text-sm font-bold text-slate-800">{doc.value || 'N/A'}</p>
                      )}
                      {doc.expiry && (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Expires: {formatDate(doc.expiry).split(',')[0]}
                        </p>
                      )}
                      {doc.image && (
                        <div className="mt-3">
                          <a href={doc.image} target="_blank" rel="noreferrer">
                            <img src={doc.image} alt={doc.label} className="h-28 w-auto rounded-lg object-contain ring-1 ring-slate-200 bg-white" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm font-semibold text-slate-500">
                  No store verification documents were added yet.
                </p>
              )}
            </Card>

            <Card className="border-none p-6 shadow-xl ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <HiOutlineBuildingOffice2 className="h-5 w-5 text-slate-500" />
                <h3 className="text-lg font-black text-slate-900">Bank & UPI details</h3>
              </div>

              {bankItems.length > 0 || seller?.bankInfo?.upiQrImage ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {bankItems.map((item) => (
                    <div key={item.label} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 break-all text-sm font-bold text-slate-800">{item.value}</p>
                    </div>
                  ))}
                  {seller?.bankInfo?.upiQrImage && (
                    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        UPI QR Code
                      </p>
                      <div className="mt-3">
                        <a href={seller.bankInfo.upiQrImage} target="_blank" rel="noreferrer">
                          <img src={seller.bankInfo.upiQrImage} alt="UPI QR" className="h-28 w-auto rounded-lg object-contain ring-1 ring-slate-200 bg-white" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm font-semibold text-slate-500">
                  No bank details were added yet.
                </p>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none p-6 shadow-xl ring-1 ring-slate-100">
              <h3 className="text-lg font-black text-slate-900">Contact details</h3>
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                    <HiOutlineEnvelope className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="ds-label">Email</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {infoValue(seller.email)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                    <HiOutlinePhone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="ds-label">Phone</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {infoValue(seller.phone)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                    <HiOutlinePhone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="ds-label">Alternate Phone</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {infoValue(seller.shopInfo?.alternatePhone)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                    <HiOutlineEnvelope className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="ds-label">Support Email</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {infoValue(seller.shopInfo?.supportEmail)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                    <HiOutlineMapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="ds-label">Store address</p>
                    <p className="mt-1 text-sm font-bold leading-6 text-slate-900">
                      {infoValue(seller.location, 'Location not added')}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-none p-6 shadow-xl ring-1 ring-slate-100">
              <h3 className="text-lg font-black text-slate-900">Approval summary</h3>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <div className="flex items-center gap-2">
                    <HiOutlineCheckBadge className="h-5 w-5 text-emerald-700" />
                    <p className="text-sm font-black text-emerald-900">Seller approved</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-emerald-800">
                    This store can access the quick seller dashboard.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <div className="flex items-start gap-3">
                    <HiOutlineCalendarDays className="mt-0.5 h-5 w-5 text-slate-500" />
                    <div>
                      <p className="ds-label">Application date</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {formatDate(seller.applicationDate)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <p className="ds-label">Admin notes</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                    {infoValue(seller.approvalNotes, 'No approval notes added.')}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDetail;
