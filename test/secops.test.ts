import { describe, it, expect } from "vitest";
import { WazuhAuditLogger, WazuhSecurityEvent } from "../src/secops/wazuhLogger";
import { PagerDutyDispatcher } from "../src/secops/pagerdutyNotifier";

describe("Wazuh Audit Logger", () => {
  it("should format valid JSON log matching Wazuh decoder specifications", () => {
    const event: WazuhSecurityEvent = {
      source: "node-ts-api-gateway",
      event_type: "rate_limit",
      client_ip: "192.168.1.105",
      request_method: "POST",
      request_path: "/api/v1/checkout",
      status_code: 429,
      message: "Rate limit threshold breached for client IP",
      mitre_attack_id: "T1499",
    };

    const formatted = WazuhAuditLogger.formatEvent(event);
    const parsed = JSON.parse(formatted);

    expect(parsed.source).toBe("node-ts-api-gateway");
    expect(parsed.event_type).toBe("rate_limit");
    expect(parsed.http.status_code).toBe(429);
    expect(parsed.mitre.id).toBe("T1499");
  });
});

describe("PagerDuty Dispatcher", () => {
  it("should build structured Events API v2 payload with dedup key", () => {
    const dispatcher = new PagerDutyDispatcher("test-routing-key-99");
    const payload = dispatcher.buildPayload({
      summary: "502 Bad Gateway upstream cluster timeout",
      severity: "critical",
      customDetails: {
        upstream_service: "payment-svc",
        latency_ms: 5020,
      },
    });

    expect(payload.routing_key).toBe("test-routing-key-99");
    expect(payload.payload.severity).toBe("critical");
    expect(payload.payload.summary).toContain("502 Bad Gateway");
    expect(payload.dedup_key).toMatch(/^gateway-\d+$/);
  });
});
