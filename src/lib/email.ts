import { Resend } from "resend";
import { orderConfirmationHtml, orderShippedHtml, ownerNewOrderHtml } from "./email-templates";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? "noreply@fatcatshop.com";

export async function sendOrderConfirmation(params: {
  to: string;
  orderNumber: string;
  firstName: string;
  items: { title: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  recommendationCode?: string | null;
}): Promise<void> {
  if (!resend) {
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Order confirmed: ${params.orderNumber}`,
    html: orderConfirmationHtml(params),
  });
}

export async function sendOwnerNewOrder(params: {
  orderNumber: string;
  customerName: string;
  email: string;
  total: number;
  items: { title: string; quantity: number; unitPrice: number; total: number }[];
}): Promise<void> {
  if (!resend) {
    return;
  }
  const to = process.env.OWNER_EMAIL ?? "grace.by.wang@gmail.com";
  await resend.emails.send({
    from: FROM,
    to,
    subject: `New order received: ${params.orderNumber}`,
    html: ownerNewOrderHtml(params),
  });
}

export async function sendOrderShipped(params: {
  to: string;
  orderNumber: string;
  firstName: string;
  trackingNote?: string | null;
}): Promise<void> {
  if (!resend) {
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Your order ${params.orderNumber} has shipped!`,
    html: orderShippedHtml(params),
  });
}
