import {createContext,useContext} from "react";
export const TaxContext=createContext("");
export const useTaxState=()=>useContext(TaxContext);
