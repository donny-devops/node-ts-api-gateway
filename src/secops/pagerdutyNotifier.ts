/**
 * PagerDuty Events API v2 Incident Dispatcher for API Gateway.
 */
export interface PagerDutyAlertOptions {
  summary: string;
  severity: "critical" | "error" | "warning" | "info";
  source?: string;
  routingKey?: string;
  customDetails?: Record<string, unknown>;
}

export class PagerDutyDispatcher {
  private routingKey: string;

  constructor(routingKey?: string) {
    this.routingKey = routingKey || process.env.PAGERDUTY_ROUTING_KEY || "mock-gateway-routing-key";
  }

  public buildPayload(options: PagerDutyAlertOptions) {
    return {
      routing_key: options.routingKey || this.routingKey,
      event_action: "trigger",
      dedup_key: `gateway-${Math.abs(this.hashCode(options.summary)) % 1000000}`,
      payload: {
        summary: `[API Gateway] ${options.summary}`,
        severity: options.severity,
        source: options.source || "node-ts-api-gateway",
        component: "ingress-gateway",
        custom_details: options.customDetails || {},
      },
    };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
