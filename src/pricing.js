// Final price shown to the user: item + shipping + estimated sales tax.
// Rates are approximate combined state + average local sales tax.
export const STATE_TAX = {
  AL: 9.29, AK: 1.82, AZ: 8.38, AR: 9.46, CA: 8.85, CO: 7.81, CT: 6.35, DE: 0, DC: 6.0, FL: 7.0, GA: 7.38,
  HI: 4.5, ID: 6.03, IL: 8.86, IN: 7.0, IA: 6.94, KS: 8.65, KY: 6.0, LA: 9.56, ME: 5.5, MD: 6.0, MA: 6.25,
  MI: 6.0, MN: 8.04, MS: 7.06, MO: 8.39, MT: 0, NE: 6.97, NV: 8.24, NH: 0, NJ: 6.6, NM: 7.62, NY: 8.53,
  NC: 7.0, ND: 6.96, OH: 7.24, OK: 8.99, OR: 0, PA: 6.34, RI: 7.0, SC: 7.5, SD: 6.11, TN: 9.55, TX: 8.2,
  UT: 7.25, VT: 6.36, VA: 5.77, WA: 9.38, WV: 6.55, WI: 5.43, WY: 5.44
};
const KEY = "flipscout-tax-state";
export function loadTaxState() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } }
export function saveTaxState(st) { try { localStorage.setItem(KEY, st); } catch {} }
export function taxRate(state) { return state && STATE_TAX[state] != null ? STATE_TAX[state] / 100 : 0.075; }

// Big retailers ship most PC parts free over $35; marketplaces vary by seller.
const FREE_OVER_35 = new Set(["amazon", "bestbuy", "walmart", "newegg", "microcenter", "bhphoto", "adorama"]);

export function finalPrice(item, state) {
  const base = Number(item?.itemPrice ?? item?.totalPrice) || 0;
  let shipping = 0, shipNote;
  if (item?.shippingKnown) { shipping = Number(item.shipping) || 0; shipNote = shipping ? "ship $" + shipping.toFixed(2) : "free ship"; }
  else if (FREE_OVER_35.has(item?.marketplace) && base >= 35) shipNote = "free ship (est.)";
  else shipNote = "shipping not listed";
  const rate = taxRate(state);
  const tax = Math.round(base * rate * 100) / 100;
  return { total: Math.round((base + shipping + tax) * 100) / 100, base, shipping, tax, shipNote, rate, estimatedTax: true };
}
