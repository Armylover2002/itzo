import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Tag } from 'lucide-react';

const FeatureCard = ({ icon, title, className, delay }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.8 }}
    whileInView={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, delay, type: "spring", stiffness: 100 }}
    viewport={{ once: true }}
    className={`absolute bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 flex flex-col items-center justify-center gap-3 hover:scale-105 hover:shadow-[0_15px_40px_rgb(0,0,0,0.1)] transition-all cursor-pointer w-[135px] h-[135px] z-20 ${className}`}
  >
    <div className="text-[42px] leading-none flex items-center justify-center h-12 drop-shadow-sm">
      {icon}
    </div>
    <span className="text-[13px] font-semibold text-slate-700 text-center leading-tight">{title}</span>
  </motion.div>
);

const AppFeaturesSection = React.memo(function AppFeaturesSection() {
  return (
    <div className="w-full bg-orange-50 pt-20 pb-12 md:pb-20 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 flex flex-col items-center">

        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-[40px] md:text-[52px] font-black text-primary text-center leading-tight mb-5 tracking-tight"
        >
          Everything you need,<br/>in one app
        </motion.h2>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-[20px] text-slate-500 text-center max-w-[600px] mb-8 md:mb-12 leading-snug font-medium px-4"
        >
          A handful of handy features, built to make ordering food a breeze
        </motion.p>

        {/* Interactive Area */}
        <div className="relative w-full max-w-5xl h-[450px] md:h-[550px] flex justify-center mt-4">
          
          {/* Left Cards */}
          <div className="hidden md:block">
            <FeatureCard icon="🥗" title="Healthy" className="left-[5%] top-[25%]" delay={0.3} />
            
            {/* Custom Veg Mode Icon */}
            <FeatureCard 
              icon={
                <div className="w-[52px] h-[26px] bg-green-600 rounded-full flex items-center px-1 justify-end shadow-inner border-[1.5px] border-green-700">
                  <div className="w-[18px] h-[18px] bg-white rounded-full shadow-sm"></div>
                </div>
              } 
              title="Veg Mode" 
              className="left-[23%] top-[5%]" 
              delay={0.4} 
            />
            
            <FeatureCard icon="🥂" title="Plan a Party" className="left-[8%] top-[60%]" delay={0.5} />
            <FeatureCard icon="🎁" title="Gift Cards" className="left-[26%] top-[45%]" delay={0.6} />
          </div>

          {/* Right Cards */}
          <div className="hidden md:block">
            <FeatureCard icon="🍝" title="Gourmet" className="right-[25%] top-[15%]" delay={0.4} />
            
            {/* Custom Offers Icon */}
            <FeatureCard 
              icon={
                <div className="relative flex items-center justify-center w-12 h-12 bg-primary text-white rounded-lg rotate-12 shadow-md border-2 border-primary">
                  <span className="font-bold text-xl -rotate-12">%</span>
                </div>
              } 
              title="Offers" 
              className="right-[6%] top-[5%]" 
              delay={0.5} 
            />
            
            <FeatureCard icon="🚆" title="Food on Train" className="right-[24%] top-[55%]" delay={0.6} />
            <FeatureCard icon="🍔" title="Collections" className="right-[5%] top-[45%]" delay={0.7} />
          </div>

          {/* Center Phone */}
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2, type: "spring", stiffness: 80 }}
            className="absolute bottom-0 md:-bottom-4 w-[280px] md:w-[320px] h-[440px] md:h-[500px] bg-white rounded-[3rem] border-[12px] border-slate-800 shadow-2xl flex flex-col items-center pt-24 z-10"
          >
            {/* Phone Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[110px] h-[24px] bg-slate-800 rounded-b-[1.25rem] flex justify-center items-center">
               <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
            </div>
            
            {/* Center Card Inside Phone */}
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-orange-50 p-6 md:p-8 flex flex-col items-center gap-4 w-[180px] md:w-[210px]">
               <div className="relative mt-2">
                 <Calendar className="w-16 h-16 text-orange-200" strokeWidth={1.5} />
                 <div className="absolute -bottom-2 -left-3 bg-white rounded-full p-[2px] shadow-sm">
                   <Clock className="w-8 h-8 text-primary bg-white rounded-full" strokeWidth={2.5} />
                 </div>
               </div>
               <span className="text-center font-medium text-slate-700 text-sm md:text-base leading-snug mt-2">
                 Schedule<br/>your order
               </span>
            </div>

            {/* Phone Home Bar */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-24 h-1.5 bg-slate-200 rounded-full"></div>
          </motion.div>

        </div>
      </div>
    </div>
  );
});

export default AppFeaturesSection;
