/*
Copyright 2025 Adobe. All rights reserved.
*/

/// <reference types="@fastly/js-compute" />

import * as response from './lib/response.js';
import { log } from './lib/log.js';

// ================== PRICE & STOCK HANDLER (Demo) ==================
async function priceStockHandler(req) {
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId') || url.searchParams.get('sku');

  if (!productId) {
    return new Response(JSON.stringify({ 
      error: "productId or sku is required" 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Hardcoded data for Demo
  const demoProducts = {
    "1": { price: 299.99, stock: 45 },
    "2": { price: 149.50, stock: 12 },
    "3": { price: 899.00, stock: 0 },
    "4": { price: 199.99, stock: 25 },
    "5": { price: 199.99, stock: 25 },
    "6": { price: 199.99, stock: 0 },
    "7": { price: 199.99, stock: 25 },
    "8": { price: 199.99, stock: 25 },
    "9": { price: 199.99, stock: 0 },
    "10": { price: 199.99, stock: 25 }
  };

  const product = demoProducts[productId] || { price: 199.99, stock: 25 };

  const result = {
    productId: productId,
    price: product.price,
    stock: product.stock,
    status: product.stock > 0 ? "In Stock" : "Out of Stock",
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "max-age=60"
    }
  });
}

// ===================== MAIN REQUEST HANDLER =====================
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const req = event.request;
  const url = new URL(req.url);

  let finalResponse;

  try {
    if (url.pathname === "/api/price-stock") {
      finalResponse = await priceStockHandler(req);
    } 
    else {
      finalResponse = response.notFound();
    }
  } catch (err) {
    console.error(err);
    finalResponse = response.error();
  }

  log(req, finalResponse);
  return finalResponse;
}