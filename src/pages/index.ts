/**
 * Page-object barrel.
 *
 * Specs should `import { loginPage } from "@pages"` rather than reaching into
 * individual files. Keeps imports tidy and lets us swap a page implementation
 * behind the scenes without touching specs.
 *
 * Add each new page / component export here.
 */
export { loginPage, LoginPage } from "./login.page.js"
export { staffTokenLoginPage, StaffTokenLoginPage } from "./staff-token-login.page.js"
export { customerDisplayPage, CustomerDisplayPage } from "./customer-display.page.js"
export { customerPage, CustomerPage } from "./customer.page.js"
export { androidAppShellPage, AndroidAppShellPage } from "./android/app-shell.page.js"

// Order flow (create order → Review order → Charge; discounts; order detail)
export { ordersListPage, OrdersListPage } from "./order/orders-list.page.js"
export { saleFlowPage, SaleFlowPage } from "./order/sale-flow.page.js"
export { reviewOrderPage, ReviewOrderPage } from "./order/review-order.page.js"
export { promoRewardPage, PromoRewardPage } from "./order/promo-reward.page.js"
export { itemDiscountPage, ItemDiscountPage } from "./order/item-discount.page.js"
export { orderDetailPage, OrderDetailPage } from "./order/order-detail.page.js"

// Order History browse surface (list + tabs + date + filter + search; per-customer history)
export { orderHistoryPage, OrderHistoryPage } from "./order/order-history.page.js"
export { orderFilterPage, OrderFilterPage } from "./order/order-filter.page.js"

// Payment / checkout (Payment method → tender → finalize + receipt)
export { paymentMethodPage, PaymentMethodPage } from "./payment/payment-method.page.js"
export { cashPaymentPage, CashPaymentPage } from "./payment/cash-payment.page.js"
export { giftCardPaymentPage, GiftCardPaymentPage } from "./payment/gift-card-payment.page.js"
export { otherPaymentPage, OtherPaymentPage } from "./payment/other-payment.page.js"
export { tipPage, TipPage } from "./payment/tip.page.js"
export { cardPaymentPage, CardPaymentPage } from "./payment/card-payment.page.js"
export { paymentCompletePage, PaymentCompletePage } from "./payment/payment-complete.page.js"

// Components
export { header, HeaderComponent } from "./components/header.component.js"
