import { providerStatus } from "./_lib/market.js";

export default function handler(req,res) {
  res.status(200).json({sources:providerStatus()});
}
