import axios from 'axios';
import { getBaseUrl } from '../../../../config/apiConfig';

const API_BASE_URL = getBaseUrl();
const RETURN_API_URL = `${API_BASE_URL}/v1/quick-commerce/returns`;

// Helper to get token
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

export const returnApi = {
  // Create a new return request
  createReturn: async (returnData) => {
    try {
      const response = await axios.post(RETURN_API_URL, returnData, getAuthHeaders());
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get user's returns list
  getReturns: async (params = {}) => {
    try {
      const response = await axios.get(RETURN_API_URL, {
        ...getAuthHeaders(),
        params
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get single return details
  getReturnDetail: async (returnId) => {
    try {
      const response = await axios.get(`${RETURN_API_URL}/${returnId}`, getAuthHeaders());
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Cancel return request
  cancelReturn: async (returnId, reason = '') => {
    try {
      const response = await axios.post(`${RETURN_API_URL}/${returnId}/cancel`, { reason }, getAuthHeaders());
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Resend pickup OTP
  resendOtp: async (sellerReturnId) => {
    try {
      const response = await axios.post(`${RETURN_API_URL}/legs/${sellerReturnId}/resend-otp`, {}, getAuthHeaders());
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Upload return evidence images
  uploadImages: async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${RETURN_API_URL}/upload-images`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};
