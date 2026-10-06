import "dotenv/config";
import express from "express";
import cors from "cors";
import sourcesHandler from "../api/sources.js";
import dealsHandler from "../api/deals/search.js";
import providerTestHandler from "../api/providers/test.js";
import pcHandler from "../api/market/pc.js";

const app=express();
app.use(cors());
app.use(express.json());

app.get("/api/health",(req,res)=>res.json({ok:true,service:"flipscout-api",time:new Date().toISOString()}));
app.get("/api/sources",sourcesHandler);
app.post("/api/deals/search",dealsHandler);
app.post("/api/market/pc",pcHandler);
app.post("/api/providers/test",providerTestHandler);
app.use((error,req,res,next)=>{console.error("API request failed",error.name);res.status(500).json({available:false,message:"Market service unavailable. Please try again."});});

const port=process.env.PORT||8787;
app.listen(port,()=>console.log("FlipScout API running on port "+port));
