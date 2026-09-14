import React from 'react';
import { RenderOrderSummary } from './renderers/OrderSummaryRenderers';

/**
 * OrderSummaryModal - Ported to Original White/Green Theme.
 * Post-delivery success screen.
 */
export const OrderSummaryModal = ({ order, onDone }) => {
  return <RenderOrderSummary order={order} onDone={onDone} />;
};
