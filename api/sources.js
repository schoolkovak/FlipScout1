import { providerStatus } from "./_lib/market.js";

export default function handler(req,res) {
  const providerKeys={
    SERPER_API_KEY:req.headers["x-serper-key"]||"",
    SEARCHAPI_API_KEY:req.headers["x-searchapi-key"]||""
  };
  res.status(200).json({sources:providerStatus(providerKeys)});
}
