import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest";
import { inngestFunctions } from "@/server/controllers/inngest.controller";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
