import * as earningsService from '../services/earnings.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

export const getEarnings = async (req, res, next) => {
    try {
        const earnings = await earningsService.getEarnings(req.user._id);
        return res.status(200).json(ApiResponse.success(earnings, 'Earnings fetched'));
    } catch (err) {
        next(err);
    }
};

/**
 * Get transaction history for barber
 * Includes monthly revenue summary and paginated transaction list
 */
export const getTransactions = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const result = await earningsService.getTransactions(req.user._id, query);
        return res.status(200).json(
            ApiResponse.paginated(
                result.transactions,
                result.pagination,
                'Transactions fetched',
                { monthlyRevenue: result.monthlyRevenue },
            ),
        );
    } catch (err) {
        next(err);
    }
};

/**
 * Get detailed transaction information
 */
export const getTransactionDetail = async (req, res, next) => {
    try {
        const { id } = getValidatedRequestData(req, 'params');
        const transaction = await earningsService.getTransactionDetail(req.user._id, id);
        return res.status(200).json(ApiResponse.success(transaction, 'Transaction detail fetched'));
    } catch (err) {
        next(err);
    }
};

/**
 * Download transaction statement (PDF only)
 */
export const downloadStatement = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const result = await earningsService.generateStatement(req.user._id, query);
        
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        // PDF: pipe the stream to response
        result.stream.pipe(res);
    } catch (err) {
        next(err);
    }
};
