export const sendResponse = (res, statusCode, message, data = null) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

export const sendError = (res, statusCode, message) => {
    return res.status(statusCode).json({
        success: false,
        message
    });
};
