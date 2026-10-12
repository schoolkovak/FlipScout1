// Deal ordering shared by the API and the browser so the UI can re-sort
// already-loaded results without another provider request.
const byTotal = (a, b) => (Number(a.totalPrice) || 0) - (Number(b.totalPrice) || 0);
const byKnownShipping = (a, b) => Number(Boolean(b.shippingKnown)) - Number(Boolean(a.shippingKnown));
const byScore = (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0);

export const DEAL_SORTS = {
  best: (a, b) => byScore(a, b) || byTotal(a, b),
  lowest: (a, b) => byTotal(a, b) || byKnownShipping(a, b) || byScore(a, b),
  under: (a, b) => (Number(b.percentVsMarket) || 0) - (Number(a.percentVsMarket) || 0) || byTotal(a, b),
  flip: (a, b) => ((Number(b.percentVsMarket) || 0) + (Number(b.score) || 0) / 10) - ((Number(a.percentVsMarket) || 0) + (Number(a.score) || 0) / 10) || byTotal(a, b),
  budget: (a, b) => (Number(Boolean(b.withinPartBudget)) - Number(Boolean(a.withinPartBudget))) || Math.abs(b.budgetLeft || 0) - Math.abs(a.budgetLeft || 0) || byTotal(a, b)
};

export const DEAL_SORT_OPTIONS = [
  { value: "best", label: "Best Deal" },
  { value: "lowest", label: "Lowest Total Price" },
  { value: "under", label: "Most Under Market" },
  { value: "flip", label: "Best for Flip" },
  { value: "budget", label: "Best Fit for Budget" }
];

export function sortDeals(items, sortBy = "best") {
  return (items || []).slice().sort(DEAL_SORTS[sortBy] || DEAL_SORTS.best);
}
