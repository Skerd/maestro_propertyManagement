/**
 * DMS connector adapter interface (§3.P).
 *
 * Config-driven, feature-flagged outbound push of ProjectDocument / IncomingInvoice
 * to an external DMS. One reference adapter (generic webhook) is provided; named
 * adapters (M-Files / Garaio REM / REM4you / Therefore) implement DmsAdapter behind
 * config + their own credentials — never hardcode secrets here.
 */
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";

export interface DmsPushPayload {
    company: string;
    docType: "projectDocument" | "incomingInvoice";
    docId: string;
    title?: string;
    metadata?: Record<string, unknown>;
    fileUrl?: string;
}

export interface DmsAdapter {
    readonly name: string;
    isConfigured(): boolean;
    push(payload: DmsPushPayload, logger?: serverLogger): Promise<{ok: boolean; ref?: string; error?: string}>;
}

/** Reference adapter: POSTs the payload to a configured webhook (PM_DMS_WEBHOOK_URL). */
export class WebhookDmsAdapter implements DmsAdapter {
    readonly name = "webhook";
    isConfigured(): boolean {
        return !!process.env.PM_DMS_WEBHOOK_URL;
    }
    async push(payload: DmsPushPayload, parentLogger?: serverLogger): Promise<{ok: boolean; ref?: string; error?: string}> {
        const logger = getLogger("dms_webhook_adapter", parentLogger);
        const url = process.env.PM_DMS_WEBHOOK_URL;
        if (!url) return {ok: false, error: "dms_webhook_not_configured"};
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {"content-type": "application/json", ...(process.env.PM_DMS_WEBHOOK_TOKEN ? {authorization: `Bearer ${process.env.PM_DMS_WEBHOOK_TOKEN}`} : {})},
                body: JSON.stringify(payload),
            });
            if (!res.ok) return {ok: false, error: `dms_webhook_http_${res.status}`};
            return {ok: true, ref: `webhook:${payload.docId}`};
        } catch (e: unknown) {
            logger.err(`DMS webhook push failed: ${e instanceof Error ? e.message : String(e)}`);
            return {ok: false, error: "dms_webhook_error"};
        }
    }
}

const registry: Record<string, DmsAdapter> = {
    webhook: new WebhookDmsAdapter(),
    // Named adapters register here behind config + credentials:
    // mfiles: new MFilesDmsAdapter(), garaio: new GaraioRemDmsAdapter(), ...
};

/** Returns the configured DMS adapter selected by PM_DMS_ADAPTER (default "webhook"), or null if unconfigured. */
export function getActiveDmsAdapter(): DmsAdapter | null {
    const key = process.env.PM_DMS_ADAPTER || "webhook";
    const adapter = registry[key];
    if (!adapter || !adapter.isConfigured()) return null;
    return adapter;
}
