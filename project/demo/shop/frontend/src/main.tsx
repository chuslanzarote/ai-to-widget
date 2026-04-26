import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "./index.css";

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("No #root element");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
