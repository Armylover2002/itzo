import React from 'react';
import Card from '@shared/components/ui/Card';
import Button from '@shared/components/ui/Button';
import Badge from '@shared/components/ui/Badge';
import { HiOutlineUserAdd } from 'react-icons/hi';

const UserManagement = () => {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="ds-h1">Platform Users</h2>
                <Button>
                    <HiOutlineUserAdd className="mr-2 h-5 w-5" />
                    Add Internal User
                </Button>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="ds-table-header-cell">User</th>
                                <th className="ds-table-header-cell">Role</th>
                                <th className="ds-table-header-cell">Status</th>
                                <th className="ds-table-header-cell">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[1, 2, 3, 4].map((i) => (
                                <tr key={i}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="h-9 w-9 bg-gray-200 rounded-full mr-3"></div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-sm">John Doe {i}</p>
                                                <p className="text-xs text-gray-500">john{i}@example.com</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">SELLER</td>
                                    <td className="px-6 py-4">
                                        <Badge variant="success">Active</Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Manage</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default UserManagement;
