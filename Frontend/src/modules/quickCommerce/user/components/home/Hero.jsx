import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Tag, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroVideo from '@/assets/hero_video.mp4';
import LazyImage from '@/shared/components/LazyImage';

const banners = [
    {
        id: 1,
        image: "https://images.unsplash.com/photo-1573246123716-6b1782bfc499?q=80&w=1965&auto=format&fit=crop", // Changed Image
        badge: "Best Seller",
        badgeIcon: Sparkles,
        badgeColor: "bg-red-500 text-white",
        title: "Fresh",
        highlight: "Vegetables",
        highlightColor: "text-green-300",
        subtitle: "Hand-picked daily for maximum freshness and taste.",
        cta: "Shop Veggies"
    },
    {
        id: 2,
        image: "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?q=80&w=1974&auto=format&fit=crop", // Changed Image
        badge: "Hot Deal",
        badgeIcon: Tag,
        badgeColor: "bg-red-600 text-white",
        title: "Summer",
        highlight: "Sale",
        highlightColor: "text-yellow-300",
        subtitle: "Get cool discounts on all refreshing summer drinks.",
        cta: "View Offers"
    },
    {
        id: 3,
        image: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=2070&auto=format&fit=crop", // Changed Image
        badge: "New Stock",
        badgeIcon: Star,
        badgeColor: "bg-blue-600 text-white",
        title: "Healthy",
        highlight: "Choices",
        highlightColor: "text-cyan-300",
        subtitle: "Everything you need for a balanced and healthy diet.",
        cta: "Start Healthy"
    }
];

const Hero = () => {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % banners.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <section className="relative w-full overflow-hidden bg-[#0c831f] pt-12 pb-12 md:pb-24 lg:pt-16">

            {/* --- Corner Decorations (Leaves/Flowers) --- */}
            <div className="absolute top-0 left-0 w-64 h-64 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                <LazyImage src="https://pngimg.com/uploads/leaves/leaves_PNG10756.png" className="w-full h-full object-contain rotate-180" alt="" />
            </div>

            <div className="absolute bottom-20 left-10 w-32 h-32 opacity-80 pointer-events-none hidden md:block animate-pulse duration-[4000ms]">
                <LazyImage src="https://uploads-ssl.webflow.com/646f04c6439a8234388365f5/6470659779df3a0c2049d562_flower-white.svg" className="w-full h-full object-contain invert hue-rotate-180 brightness-200" alt="" />
            </div>

            <div className="absolute top-10 right-0 w-48 h-48 translate-x-1/3 opacity-30 pointer-events-none rotate-45">
                <LazyImage src="https://pngimg.com/uploads/spinach/spinach_PNG10.png" className="w-full h-full object-contain" alt="" />
            </div>


            {/* Container with responsive padding: px-4 on mobile, 50px on desktop */}
            <div className="container relative z-10 w-full max-w-[1920px] mx-auto px-4 md:px-[50px] grid gap-6 md:grid-cols-2 items-center">

                {/* Left Side: MAXIMIZED Banner Carousel */}
                <div className="relative w-full flex justify-start animate-in fade-in slide-in-from-left-8 duration-700 z-20">
                    <div className="relative w-full aspect-video md:h-[600px] rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl group border-[3px] md:border-[6px] border-white/10 backdrop-blur-sm bg-white/5">

                        {banners.map((banner, index) => (
                            <div
                                key={banner.id}
                                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                            >
                                {/* Background Image */}
                                <LazyImage
                                    src={banner.image}
                                    alt={banner.title}
                                    className={`w-full h-full object-cover transition-transform duration-[5000ms] ${index === current ? 'scale-110' : 'scale-100'}`}
                                />

                                {/* Content Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 md:p-12 flex flex-col justify-end text-white">
                                    <div className={`transform transition-all duration-700 ${index === current ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                                        <div className="flex items-center gap-2 mb-2 md:mb-3">
                                            <span className={`${banner.badgeColor} font-black px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs uppercase tracking-wider shadow-lg flex items-center gap-1`}>
                                                <banner.badgeIcon size={12} className="md:w-[14px] md:h-[14px]" fill="currentColor" /> {banner.badge}
                                            </span>
                                        </div>

                                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-heading font-extrabold mb-2 md:mb-4 leading-[1.1] drop-shadow-lg">
                                            {banner.title} <br /> <span className={banner.highlightColor}>{banner.highlight}</span>
                                        </h1>

                                        <p className="font-medium text-sm md:text-xl text-gray-200 mb-4 md:mb-8 max-w-md leading-relaxed line-clamp-2 md:line-clamp-none">
                                            {banner.subtitle}
                                        </p>

                                        <Button className="bg-white text-[#0c831f] hover:bg-[#f0fdf4] hover:scale-105 active:scale-95 font-bold px-6 py-5 md:px-8 md:py-7 rounded-xl md:rounded-2xl text-sm md:text-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all w-auto">
                                            {banner.cta} <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5 transition-transform group-hover:translate-x-1" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Carousel Indicators */}
                        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 flex gap-1.5 md:gap-2">
                            {banners.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrent(index)}
                                    className={`h-2 rounded-full transition-all duration-300 ${index === current ? 'bg-white w-6 md:w-8' : 'bg-white/50 hover:bg-white/80 w-2 md:w-2.5'}`}
                                    aria-label={`Go to slide ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Video MAXIMIZED (Slightly Reduced Height/Width) */}
                <div className="relative w-full flex justify-center md:justify-end animate-in fade-in zoom-in duration-1000 delay-200">
                    <div className="relative z-10 w-full max-w-[700px] aspect-video overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] shadow-lg transform hover:scale-[1.01] transition-transform duration-500">
                        <video
                            src={heroVideo}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover scale-[1.02]"
                        />
                        <div className="absolute inset-0 ring-1 ring-black/5 rounded-[1.5rem] md:rounded-[2.5rem] pointer-events-none"></div>
                    </div>
                </div>
            </div>

            {/* Bottom Wave - White separator */}
            <div className="absolute bottom-[-1px] left-0 w-full overflow-hidden leading-[0]">
                <svg className="relative block w-[calc(100%+1.3px)] h-[40px] md:h-[100px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <path fill="#ffffff" fillOpacity="1" d="M0,224L48,229.3C96,235,192,245,288,234.7C384,224,480,192,576,192C672,192,768,224,864,240C960,256,1056,256,1152,240C1248,224,1344,192,1392,176L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                </svg>
            </div>
        </section>
    );
};

export default Hero;
