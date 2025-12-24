export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}
export declare const RATE_LIMITS: {
    readonly sessionInit: {
        readonly windowMs: number;
        readonly maxRequests: 10;
    };
    readonly signaling: {
        readonly windowMs: 1000;
        readonly maxRequests: 30;
    };
    readonly report: {
        readonly windowMs: number;
        readonly maxRequests: 5;
    };
    readonly default: {
        readonly windowMs: 1000;
        readonly maxRequests: 100;
    };
};
export declare function checkRateLimit(identifier: string, config?: RateLimitConfig): {
    allowed: boolean;
    remaining: number;
    resetIn: number;
};
//# sourceMappingURL=rate-limiter.d.ts.map
