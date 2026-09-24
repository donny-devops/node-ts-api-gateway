/**
 * Wazuh SIEM JSON Audit Logger.
 * Formats API Gateway security events to conform with Wazuh log decoder specifications.
 */
export interface WazuhSecurityEvent {
  timestamp?: string;
  source: string;
  event_type: "authentication" | "authorization" | "rate_limit" | "threat_detected" | "server_error";
  client_ip: string;
  user_id?: string;
  request_method: string;
  request_path: string;
  status_code: number;
  message: string;
  mitre_attack_id?: string;
}

export class WazuhAuditLogger {
  public static formatEvent(event: WazuhSecurityEvent): string {
    const payload = {
      timestamp: event.timestamp || new Date().toISOString(),
      source: "node-ts-api-gateway",
      event_type: event.event_type,
      client_ip: event.client_ip,
      user_id: event.user_id || "anonymous",
      http: {
        method: event.request_method,
        path: event.request_path,
        status_code: event.status_code,
      },
      message: event.message,
      mitre: event.mitre_attack_id ? { id: event.mitre_attack_id } : undefined,
    };

    return JSON.stringify(payload);
  }
}
