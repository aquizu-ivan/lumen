import app from "./app.js";

const port = Number(process.env.PORT) || 4000;

process.on("unhandledRejection", (err) => console.error("UNHANDLED_REJECTION", err));
process.on("uncaughtException", (err) => console.error("UNCAUGHT_EXCEPTION", err));

app.listen(port, () => {
  console.log(
    `BOOT lumen-api port=${port} env=${process.env.NODE_ENV ?? "development"} gitSha=${process.env.RAILWAY_GIT_COMMIT_SHA ?? "null"}`
  );
});
