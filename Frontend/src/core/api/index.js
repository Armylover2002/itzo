import axiosInstance from "./axios";
import { getWithDedupe, invalidateCache } from "./dedupe";
import * as auth from "@/services/api/auth";

export { axiosInstance, getWithDedupe, invalidateCache, auth };

const api = {
  axios: axiosInstance,
  dedupe: { getWithDedupe, invalidateCache },
  auth,
};

export default api;
