import React, { createContext, useContext, useState } from 'react';

const ProductDetailContext = createContext();

export const useProductDetail = () => {
    const context = useContext(ProductDetailContext);
    if (!context) {
        // console.warn('useProductDetail used outside Provider');
        return {};
    }
    return context;
};

export const ProductDetailProvider = ({ children }) => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    const openProduct = (product) => {
        setSelectedProduct(product);
        setIsOpen(true);
    };

    const closeProduct = () => {
        setIsOpen(false);
        // Delay clearing product to allow close animation to finish
        setTimeout(() => setSelectedProduct(null), 300);
    };

    return (
        <ProductDetailContext.Provider value={{ selectedProduct, isOpen, openProduct, closeProduct }}>
            {children}
        </ProductDetailContext.Provider>
    );
};
