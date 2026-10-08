import { z } from 'zod';
import { PaymentMode, SaleType } from '../types';

const saleItemShape = {
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  size: z.string().trim().max(100).optional(),
  colour: z.string().trim().max(100).optional(),
};

const saleBaseShape = {
  customerId: z.number().int().positive(),
  paymentMode: z.nativeEnum(PaymentMode),
  saleType: z.nativeEnum(SaleType),
  notes: z.string().max(2000).optional(),
};

export const workerASaleSchema = z.object({
  ...saleBaseShape,
  items: z.array(z.object({
    ...saleItemShape,
    unitPrice: z.number().finite().nonnegative(),
  })).min(1),
  discountAmount: z.number().finite().nonnegative().default(0),
});

export const workerBSaleSchema = z.object({
  customerId: z.number().int().positive(),
  saleType: z.nativeEnum(SaleType),
  items: z.array(z.object({
    ...saleItemShape,
  })).min(1),
});
