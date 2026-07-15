import axiosInstance from '@core/api/axios';

const RETURN_API_URL = `/quick-commerce/returns/user`;

export const returnApi = {
  // Create a new return request
  createReturn: async (returnData) => {
    try {
      const response = await axiosInstance.post(RETURN_API_URL, returnData, { contextModule: 'customer' });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get user's returns list
  getReturns: async (params = {}) => {
    try {
      const response = await axiosInstance.get(RETURN_API_URL, {
        params,
        contextModule: 'customer'
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get single return details
  getReturnDetail: async (returnId) => {
    try {
      const response = await axiosInstance.get(`${RETURN_API_URL}/${returnId}`, { contextModule: 'customer' });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Cancel return request
  cancelReturn: async (returnId, reason = '') => {
    try {
      const response = await axiosInstance.post(`${RETURN_API_URL}/${returnId}/cancel`, { reason }, { contextModule: 'customer' });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Resend pickup OTP
  resendOtp: async (sellerReturnId) => {
    try {
      const response = await axiosInstance.post(`${RETURN_API_URL}/legs/${sellerReturnId}/resend-otp`, {}, { contextModule: 'customer' });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Upload return evidence images
  uploadImages: async (formData) => {
    try {
      const response = await axiosInstance.post(`${RETURN_API_URL}/upload-images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        contextModule: 'customer'
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};
