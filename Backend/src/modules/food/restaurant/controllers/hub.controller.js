import { sendResponse } from '../../../../utils/response.js';
import {
  listHubOutlets,
  createHubOutlet,
  updateHubOutlet,
  deleteHubOutlet,
  getHubEarnings,
  resolveNearestOutlet,
} from '../services/hub.service.js';

export const listHubOutletsController = async (req, res, next) => {
  try {
    const outlets = await listHubOutlets(req.user.userId);
    return sendResponse(res, 200, 'Outlets fetched', outlets);
  } catch (error) {
    next(error);
  }
};

export const createHubOutletController = async (req, res, next) => {
  try {
    const outlet = await createHubOutlet(req.user.userId, req.body);
    return sendResponse(res, 201, 'Outlet created', outlet);
  } catch (error) {
    next(error);
  }
};

export const updateHubOutletController = async (req, res, next) => {
  try {
    const outlet = await updateHubOutlet(req.user.userId, req.params.id, req.body);
    return sendResponse(res, 200, 'Outlet updated', outlet);
  } catch (error) {
    next(error);
  }
};

export const deleteHubOutletController = async (req, res, next) => {
  try {
    const result = await deleteHubOutlet(req.user.userId, req.params.id);
    return sendResponse(res, 200, 'Outlet removed', result);
  } catch (error) {
    next(error);
  }
};

export const getHubEarningsController = async (req, res, next) => {
  try {
    const data = await getHubEarnings(req.user.userId);
    return sendResponse(res, 200, 'Hub earnings fetched', data);
  } catch (error) {
    next(error);
  }
};

export const resolveNearestOutletController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.query;
    const data = await resolveNearestOutlet(id, lat, lng);
    return sendResponse(res, 200, 'Outlet resolved', data);
  } catch (error) {
    next(error);
  }
};
