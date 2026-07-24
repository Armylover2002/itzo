import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SellerProfile from '../../../seller/pages/Profile';
import { HiOutlineCalendarDays, HiOutlineCheckBadge } from 'react-icons/hi2';
import Card from '@shared/components/ui/Card';

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

  return (
    <SellerProfile 
      asAdmin={true} 
      adminSellerId={id} 
      onBack={() => navigate('/ecs/quick-commerce/sellers/active')}
      onProfileLoad={(data) => setSeller(data)}
    >
      {seller && (
        <Card className="p-5 sm:p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl sm:rounded-3xl mt-6 sm:mt-8">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-6 sm:mb-8 border-b border-slate-50 pb-4">
            Approval Summary
          </h3>
          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
              <div className="flex items-center gap-2">
                <HiOutlineCheckBadge className="h-5 w-5 text-emerald-700" />
                <p className="text-sm font-black text-emerald-900">Seller approved</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-emerald-800">
                This store can access the quick seller dashboard.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 flex items-start gap-3">
              <HiOutlineCalendarDays className="mt-0.5 h-5 w-5 text-slate-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Application date</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {formatDate(seller.applicationDate || seller.createdAt)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">ECS notes</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                {infoValue(seller.approvalNotes, 'No approval notes added.')}
              </p>
            </div>
          </div>
        </Card>
      )}
    </SellerProfile>
  );
};

export default SellerDetail;
