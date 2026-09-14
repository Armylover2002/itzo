import React from 'react';
import { cn } from '@/lib/utils';

const DataTable = ({ columns, data, onRowClick, className }) => {
    return (
        <div className={cn("overflow-x-auto", className)}>
            <table className="ds-table">
                <thead className="ds-table-header">
                    <tr>
                        {columns.map((column, index) => (
                            <th 
                                key={index} 
                                className={cn(
                                    "ds-table-header-cell",
                                    column.align === 'right' && 'text-right',
                                    column.align === 'center' && 'text-center'
                                )}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr 
                            key={rowIndex} 
                            className={cn(
                                "ds-table-row",
                                onRowClick && "cursor-pointer"
                            )}
                            onClick={() => onRowClick && onRowClick(row)}
                        >
                            {columns.map((column, colIndex) => (
                                <td 
                                    key={colIndex} 
                                    className={cn(
                                        "ds-table-cell",
                                        column.align === 'right' && 'text-right',
                                        column.align === 'center' && 'text-center'
                                    )}
                                >
                                    {column.cell ? column.cell(row) : row[column.accessor]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DataTable;
