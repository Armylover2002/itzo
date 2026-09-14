import React from 'react';
import ProductCard from '../components/shared/ProductCard';

const products = [
    {
        id: 1,
        name: 'Fresh Organic Strawberry',
        category: 'Fruits',
        price: 349,
        originalPrice: 499,
        image: 'https://images.unsplash.com/photo-1518635017498-87f514b751ba?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 2,
        name: 'Green Bell Pepper',
        category: 'Vegetables',
        price: 45,
        originalPrice: 60,
        image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 3,
        name: 'Fresh Avocado',
        category: 'Fruits',
        price: 120,
        originalPrice: 180,
        image: 'https://images.unsplash.com/photo-1601039641847-7857b994d704?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 4,
        name: 'Organic Broccoli',
        category: 'Vegetables',
        price: 85,
        originalPrice: 110,
        image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 5,
        name: 'Fresh Red Tomato',
        category: 'Vegetables',
        price: 35,
        originalPrice: 50,
        image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 6,
        name: 'Organic Banana Bunch',
        category: 'Fruits',
        price: 60,
        originalPrice: 80,
        image: 'https://images.unsplash.com/photo-1571771896612-6184984fc38b?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 7,
        name: 'Fresh Milk',
        category: 'Dairy',
        price: 65,
        originalPrice: 70,
        image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?q=80&w=260&auto=format&fit=crop', // Fallback image for consistent sizing
    },
    {
        id: 8,
        name: 'Whole Wheat Bread',
        category: 'Bakery',
        price: 45,
        originalPrice: 55,
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 9,
        name: 'Orange Juice',
        category: 'Drinks',
        price: 180,
        originalPrice: 220,
        image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 10,
        name: 'Chicken Breast',
        category: 'Meat',
        price: 280,
        originalPrice: 320,
        image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 11,
        name: 'Brown Eggs (12 pcs)',
        category: 'Dairy',
        price: 90,
        originalPrice: 110,
        image: 'https://images.unsplash.com/photo-1516488556308-ea2447743663?q=80&w=260&auto=format&fit=crop',
    },
    {
        id: 12,
        name: 'Potato',
        category: 'Vegetables',
        price: 30,
        originalPrice: 40,
        image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=260&auto=format&fit=crop',
    },
];

const ProductsPage = () => {
    return (
        <div className="relative z-10 py-8 w-full max-w-[1920px] mx-auto px-4 md:px-[50px] animate-in fade-in slide-in-from-bottom-4 duration-700 mt-36 md:mt-24">
            <div className="mb-8 text-left">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#0c831f] mb-1">All Products</h1>
                <p className="text-gray-500 text-sm md:text-lg font-medium">
                    Showing {products.length} fresh and organic items
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
        </div>
    );
};

export default ProductsPage;
