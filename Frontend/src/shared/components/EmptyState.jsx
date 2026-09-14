import React from 'react';

const EmptyState = ({ icon, title, description, action }) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            {icon && <div className="mb-4 text-gray-300">{icon}</div>}
            <h3 className="text-lg font-semibold text-gray-900 leading-7">{title}</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">{description}</p>
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
};

export default EmptyState;
