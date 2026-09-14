import React from 'react';
import { Timer, Zap, ArrowRight } from 'lucide-react';
import ProductCard from '../shared/ProductCard';

const FlashDeals = ({ products }) => {
    return (
        <section className="py-12 bg-slate-50 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#0c831f]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="container w-full max-w-[1920px] mx-auto px-4 md:px-[50px] relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                    <div className="flex items-center gap-6 text-center md:text-left">
                        <div className="h-16 w-16 bg-red-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-red-200 animate-pulse">
                            <Zap size={32} fill="currentColor" />
                        </div>
                        <div>
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                                    Limited Time
                                </span>
                                <div className="flex items-center gap-1 text-red-600 font-bold text-xs uppercase">
                                    <Timer size={14} /> Ending in 02:45:10
                                </div>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">Flash Deals</h2>
                        </div>
                    </div>

                    <button className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-black transition-all hover:shadow-xl active:scale-95 group">
                        View All Deals <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                    {products.map((product) => (
                        <div key={product.id} className="relative group/card h-full">
                            <ProductCard product={product} badge="HOT DEAL" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FlashDeals;
