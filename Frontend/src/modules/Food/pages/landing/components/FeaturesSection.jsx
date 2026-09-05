import React from 'react';
import { motion } from 'framer-motion';

const features = [
  {
    id: 'online-order',
    title: 'Order Online',
    subtitle: 'Stay home and order to your door',
    image: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=600&auto=format&fit=crop',
    link: '/food/user'
  },
  {
    id: 'pro',
    title: 'ItzoPro',
    subtitle: 'Unlimited free deliveries and more',
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=600&auto=format&fit=crop',
    link: '/food/user/pro'
  }
];

const FeaturesSection = React.memo(function FeaturesSection({ navigate }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => navigate(feature.link)}
            className="group cursor-pointer rounded-2xl overflow-hidden border border-gray-200 bg-white hover:shadow-xl transition-all duration-300"
          >
            <div className="h-48 w-full overflow-hidden">
              <img 
                src={feature.image} 
                alt={feature.title} 
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-5">
              <h3 className="text-xl font-bold text-gray-800 mb-1">{feature.title}</h3>
              <p className="text-gray-500 text-sm">{feature.subtitle}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

export default FeaturesSection;
