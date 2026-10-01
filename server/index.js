import "dotenv/config";
import express from "express";
import cors from "cors";
import sourcesHandler from "../api/sources.js";
import dealsHandler from "../api/deals/search.js";
import pcHandler from "../api/market/pc.js";

const app=express();
app.use(cors());
app.use(express.json());

app.get("/api/sources",sourcesHandler);
app.post("/api/deals/search",dealsHandler);
app.post("/api/market/pc",pcHandler);

const port=process.env.PORT||8787;
app.listen(port,()=>console.log("FlipScout API running on port "+port));
