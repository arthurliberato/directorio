// The bot only needs the query-runner type used by whatsapp/appointments.ts (the site's admin-db.ts holds the admin writes).
export type Run = (sql: string, params?: unknown[]) => Promise<any[]>;
