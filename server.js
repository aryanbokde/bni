const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(async () => {
    // Cron jobs are registered via src/instrumentation.ts — runs on first
    // server import inside Next's Node runtime, so the scheduler and all
    // job files get bundled into .next/server/ automatically.

    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(process.env.PORT || 3000, (err) => {
      if (err) throw err;
      console.log(
        `> Ready on http://localhost:${process.env.PORT || 3000} [${dev ? "development" : "production"}]`
      );
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
