import {Hono} from "hono";
import v1Routes from "./v1/routes.js";
const app = new Hono();
app.route("/v1", v1Routes);
export default app;
