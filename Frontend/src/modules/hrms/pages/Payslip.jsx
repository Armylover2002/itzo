import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@food/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@food/components/ui/Card';
import { ArrowLeft, FileText, Download } from 'lucide-react';

export default function Payslip() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-3xl mx-auto">
                <Button variant="ghost" className="mb-6 -ml-4 text-gray-600" onClick={() => navigate('/hrms/dashboard')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            My Payslips
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <FileText className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Payslips Generated</h3>
                            <p className="text-sm text-gray-500 max-w-sm">
                                Your payslips will appear here once the HR department processes your monthly payroll.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
