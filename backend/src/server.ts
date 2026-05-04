import dotenv from "dotenv";
import { buildApp } from "./app";

dotenv.config();

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
