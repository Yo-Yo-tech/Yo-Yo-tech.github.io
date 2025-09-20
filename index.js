import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import chalk from "chalk";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import basicAuth from "express-basic-auth";
import mime from "mime";
import fetch from "node-fetch";
import config from "./config.js";
import { createProxyMiddleware } from "http-proxy-middleware";

console.log(chalk.yellow("🚀 Starting server..."));

const __dirname = process.cwd();
const app = express();
const PORT = process.env.PORT || 8080;

if (config.challenge !== false) {
  console.log(
    chalk.green("🔒 Password protection is enabled! Listing logins below"),
  );
  Object.entries(config.users).forEach(([username, password]) => {
    console.log(chalk.blue(`Username: ${username}, Password: ${password}`));
  });
  app.use(basicAuth({ users: config.users, challenge: true }));
}

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// This is the new, dynamic proxy handler
app.use(
  "/",
  createProxyMiddleware((req) => {
    // You must find a way to extract the target URL from the request
    // Here is a common example, where the URL is in a query parameter
    // For example, https://myproxy.com/?url=https://www.google.com
    const targetUrl = req.query.url;
    if (!targetUrl) {
      // If no URL is provided, you can return a default or show an error page
      return "http://localhost:8080"; 
    }
    return targetUrl;
  }, {
    changeOrigin: true,
    selfHandleResponse: true,
    onProxyRes: (proxyRes, req, res) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(502).send("Bad Gateway");
    },
  }),
);

app.use(express.static(path.join(__dirname, "static")));

const routes = [
  { path: "/b", file: "apps.html" },
  { path: "/a", file: "games.html" },
  { path: "/play.html", file: "games.html" },
  { path: "/c", file: "settings.html" },
  { path: "/d", file: "tabs.html" },
  { path: "/", file: "index.html" },
];

routes.forEach(route => {
  app.get(route.path, (_req, res) => {
    res.sendFile(path.join(__dirname, "static", route.file));
  });
});

app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, "static", "404.html"));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, "static", "404.html"));
});

const server = http.createServer(app);

server.listen({ port: PORT });
