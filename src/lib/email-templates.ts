import { formatPrice } from "@/lib/utils";

export function orderConfirmationHtml(params: {
  orderNumber: string;
  firstName: string;
  items: { title: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  recommendationCode?: string | null;
}): string {
  const itemRows = params.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.title}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.unitPrice)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.total)}</td>
        </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 24px; margin-bottom: 8px;">Order Confirmed</h1>
    <p>Hi ${params.firstName},</p>
    <p>Thank you for your order <strong>${params.orderNumber}</strong>. Here is a summary of what you ordered:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #f9f9f9;">
          <th style="padding: 8px; text-align: left;">Item</th>
          <th style="padding: 8px; text-align: center;">Qty</th>
          <th style="padding: 8px; text-align: right;">Price</th>
          <th style="padding: 8px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <table style="width: 100%; margin-top: 8px;">
      <tr>
        <td style="padding: 4px 8px; text-align: right;">Subtotal:</td>
        <td style="padding: 4px 8px; text-align: right; width: 100px;">${formatPrice(params.subtotal)}</td>
      </tr>
      <tr>
        <td style="padding: 4px 8px; text-align: right;">Shipping:</td>
        <td style="padding: 4px 8px; text-align: right;">${formatPrice(params.shippingCost)}</td>
      </tr>
      <tr>
        <td style="padding: 4px 8px; text-align: right; font-weight: bold;">Total:</td>
        <td style="padding: 4px 8px; text-align: right; font-weight: bold;">${formatPrice(params.total)}</td>
      </tr>
    </table>

    ${params.recommendationCode ? `
    <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: bold;">Share the love!</p>
      <p style="margin: 0;">Your recommendation code: <strong style="font-size: 18px; letter-spacing: 2px;">${params.recommendationCode}</strong></p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">Share this code with friends so they can use it at checkout.</p>
    </div>
    ` : ""}

    <p style="margin-top: 24px;">We will notify you when your order ships.</p>
    <p style="color: #888; font-size: 12px; margin-top: 32px;">Fat Cat Shop</p>
  </div>
</body>
</html>`;
}

export function ownerNewOrderHtml(params: {
  orderNumber: string;
  customerName: string;
  email: string;
  total: number;
  items: { title: string; quantity: number; unitPrice: number; total: number }[];
}): string {
  const itemRows = params.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.title}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.unitPrice)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.total)}</td>
        </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 24px; margin-bottom: 8px;">New Order Received</h1>
    <p>Order <strong>${params.orderNumber}</strong> has been placed by <strong>${params.customerName}</strong> (${params.email}).</p>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #f9f9f9;">
          <th style="padding: 8px; text-align: left;">Item</th>
          <th style="padding: 8px; text-align: center;">Qty</th>
          <th style="padding: 8px; text-align: right;">Price</th>
          <th style="padding: 8px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <p style="font-size: 18px; font-weight: bold;">Order Total: ${formatPrice(params.total)}</p>
    <p style="color: #888; font-size: 12px; margin-top: 32px;">Fat Cat Shop</p>
  </div>
</body>
</html>`;
}

export function orderShippedHtml(params: {
  orderNumber: string;
  firstName: string;
  trackingNote?: string | null;
}): string {
  const trackingSection = params.trackingNote
    ? `<p style="margin-top: 16px; padding: 12px; background: #f9f9f9; border-radius: 4px;">${params.trackingNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 24px; margin-bottom: 8px;">Your Order Is On Its Way!</h1>
    <p>Hi ${params.firstName},</p>
    <p>Great news — your order <strong>${params.orderNumber}</strong> has been shipped.</p>
    ${trackingSection}
    <p style="margin-top: 24px;">Thank you for shopping with us!</p>
    <p style="color: #888; font-size: 12px; margin-top: 32px;">Fat Cat Shop</p>
  </div>
</body>
</html>`;
}
