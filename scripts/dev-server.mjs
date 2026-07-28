// Local dev server that emulates Vercel's serverless function contract
// (req.cookies, req.body, res.status/.json) for the /api/*.ts handlers,
// while delegating everything else to Vite's own dev middleware. This
// exists so local development doesn't require a Vercel account login
// (`vercel dev` needs an interactive OAuth device flow) — the /api files
// themselves stay in the exact shape Vercel expects for real deployment.
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "node:http";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function toModulePath(absoluteFilePath) {
  return "/" + path.relative(root, absoluteFilePath).split(path.sep).join("/");
}

// Mirrors Vercel's filesystem routing for /api: an exact file wins; otherwise
// the nearest ancestor directory's `[...param].ts` catch-all handles it, with
// the remaining path segments exposed on req.query[param] (as an array), same
// as Vercel does in production. Needed because several resources (auth,
// goals, groups, shopping, trips) were consolidated into single catch-all
// functions to stay under the Hobby plan's serverless function cap.
function resolveApiRoute(routePath) {
  const exactPath = path.join(root, "api", `${routePath}.ts`);
  if (existsSync(exactPath)) {
    return { filePath: exactPath, params: {} };
  }

  const segments = routePath.split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 1; i--) {
    const dir = path.join(root, "api", ...segments.slice(0, i));
    if (!existsSync(dir)) continue;

    const catchAllFile = readdirSync(dir).find((f) => /^\[\.\.\..+\]\.ts$/.test(f));
    if (!catchAllFile) continue;

    const paramName = catchAllFile.match(/^\[\.\.\.(.+)\]\.ts$/)[1];
    return {
      // Vercel's plain (non-Next.js) filesystem router captures the catch-all
      // tail as a single string via a regex group, not an array — match that
      // here so local dev matches production instead of masking the mismatch.
      filePath: path.join(dir, catchAllFile),
      params: { [paramName]: segments.slice(i).join("/") },
    };
  }

  return null;
}

const vite = await createViteServer({
  root,
  server: { middlewareMode: true },
  appType: "spa",
});

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return out;
}

function enhanceResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
    return res;
  };
  res.send = (body) => {
    res.end(body);
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname.startsWith("/api/")) {
    const routePath = url.pathname.replace(/^\/api\//, "");
    const route = resolveApiRoute(routePath);

    if (!route) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    const { filePath, params } = route;

    req.cookies = parseCookies(req.headers.cookie);
    req.query = { ...Object.fromEntries(url.searchParams), ...params };

    const rawBody = await readBody(req);
    const contentType = req.headers["content-type"] ?? "";
    if (rawBody && contentType.includes("application/json")) {
      try {
        req.body = JSON.parse(rawBody);
      } catch {
        req.body = undefined;
      }
    } else {
      req.body = rawBody || undefined;
    }

    enhanceResponse(res);

    try {
      const mod = await vite.ssrLoadModule(toModulePath(filePath));
      await mod.default(req, res);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      console.error(error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
    return;
  }

  vite.middlewares(req, res);
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Zamane dev server running at http://localhost:${port}`);
});
