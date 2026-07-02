import React from 'react';
import { useSettings } from '@core/context/SettingsContext';

const MobileFooterMessage = () => {
    const { settings } = useSettings();
    const appName = settings?.data.companyName || 'ItzoFood';

    return (
        <div className="md:hidden w-full flex flex-col items-center -mt-8 pt-0 pb-28 px-6 bg-transparent">
            <div className="w-full flex flex-col">
                <h2 className="text-[38px] leading-[1.1] font-black text-slate-300 tracking-tight text-left">
                    India's last<br />minute app <span className="text-red-500">❤️</span>
                </h2>

                <div className="w-full h-[1px] bg-slate-200 mt-6 mb-4"></div>

                <div className="text-slate-300 font-black text-2xl tracking-tighter text-left">
                    {appName}
                </div>
            </div>
        </div>
    );
};

export default MobileFooterMessage;
