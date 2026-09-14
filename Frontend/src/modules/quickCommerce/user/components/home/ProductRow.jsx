import React from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../shared/ProductCard';
import { ChevronRight } from 'lucide-react';

const ProductRow = ({ title, subtitle, products, badge }) => {
    return (
        <section className="py-8 bg-white overflow-hidden">
            <div className="container w-full max-w-[1920px] mx-auto px-4 md:px-[50px]">
                <div className="flex items-center justify-between mb-6 group cursor-pointer">
                    <div className="text-left">
                        {badge && (
                            <span className="text-[10px] font-black text-white bg-[#0c831f] px-2 py-0.5 rounded uppercase tracking-widest mb-1 inline-block">
                                {badge}
                            </span>
                        )}
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            {title}
                            <ChevronRight size={24} className="text-[#0c831f] group-hover:translate-x-1 transition-transform" />
                        </h2>
                        {subtitle && <p className="text-slate-500 font-medium text-sm md:text-base">{subtitle}</p>}
                    </div>
                    <Link to="/categories" className="text-sm font-bold text-[#0c831f] hover:underline whitespace-nowrap">
                        See All
                    </Link>
                </div>

                <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth snap-x">
                    {products.map((product) => (
                        <div key={product.id} className="min-w-[160px] md:min-w-[220px] snap-start">
                            <ProductCard product={product} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ProductRow;
