import { z } from "zod";

const ConfigSchema = z.object({
  INSTAGRAM_API_VERSION: z.string().regex(/^v\d+\.\d+$/),
  INSTAGRAM_USER_ID: z.string().min(1),
  INSTAGRAM_EXPECTED_USERNAME: z.string().regex(/^[A-Za-z0-9._]+$/).default("andrewvoxai"),
  INSTAGRAM_ACCESS_TOKEN: z.string().min(20),
  PUBLIC_BASE_URL: z.string().url().refine((u) => u.startsWith("https://") || u.startsWith("http://localhost"), {
    message: "PUBLIC_BASE_URL must use HTTPS in production",
  }),
  APPROVAL_HMAC_SECRET: z.string().min(32),
  APPROVER_USERNAME: z.string().min(1),
  APPROVER_PASSWORD: z.string().min(16),
  STATE_STORE_BACKEND: z.enum(["filesystem", "postgres"]).default("filesystem"),
  APPROVAL_STATE_DIR: z.string().min(1).default(".state"),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(4),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
}).superRefine((config, ctx) => {
  if (config.STATE_STORE_BACKEND === "postgres" && !config.DATABASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_URL"],
      message: "DATABASE_URL is required when STATE_STORE_BACKEND=postgres",
    });
  }
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${detail}`);
  }
  cached = parsed.data;
  return cached;
}
