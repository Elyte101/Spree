import { z } from "zod";

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(300),
  image: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive().max(999),
  color: z.string().max(100).nullable().optional(),
  size: z.string().max(100).nullable().optional(),
});

export const CreateOrderSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(200),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(30).nullable().optional(),
  addressLine1: z.string().min(1, "Address is required").max(300),
  addressLine2: z.string().max(300).nullable().optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1, "Country is required").max(100),
  shippingMethod: z.string().min(1).max(50),
  paymentMethod: z.enum(["momo", "card"]),
  subtotal: z.number().nonnegative(),
  shippingCost: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currency: z.string().length(3),
  items: z.array(OrderItemSchema).min(1, "Cart must have at least one item"),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const ChargeMomoSchema = CreateOrderSchema.extend({
  momoPhone: z.string().min(10, "Phone number required").max(20),
  momoProvider: z.enum(["mtn", "vod", "atl"]),
});

export const SubmitOtpSchema = z.object({
  otp: z.string().min(1).max(10),
  reference: z.string().min(1).max(128),
});

export type ChargeMomoInput = z.infer<typeof ChargeMomoSchema>;
export type SubmitOtpInput = z.infer<typeof SubmitOtpSchema>;
