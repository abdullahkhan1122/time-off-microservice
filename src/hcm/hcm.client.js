"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HcmClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let HcmClient = class HcmClient {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    get baseUrl() {
        const value = this.configService.get("HCM_BASE_URL");
        if (!value) {
            throw new common_1.BadGatewayException("HCM_BASE_URL is not configured.");
        }
        return value;
    }
    async validateAndDeduct(payload) {
        const response = await this.safeFetch(`${this.baseUrl}/validate-and-deduct`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            if (response.status === 400) {
                throw new common_1.BadRequestException("HCM rejected invalid employee/location.");
            }
            if (response.status === 409) {
                throw new common_1.ConflictException("HCM reported insufficient balance.");
            }
            throw new common_1.BadGatewayException("HCM validate-and-deduct failed.");
        }
        const data = (await response.json());
        if (!data.accepted) {
            throw new common_1.ConflictException(data.reason || "HCM rejected the request.");
        }
        return { referenceId: data.referenceId || null };
    }
    async release(employeeId, locationId, days, requestId) {
        const response = await this.safeFetch(`${this.baseUrl}/release`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ employeeId, locationId, days, requestId })
        });
        if (!response.ok) {
            throw new common_1.BadGatewayException("HCM release failed.");
        }
    }
    async getBalance(employeeId, locationId) {
        const response = await this.safeFetch(`${this.baseUrl}/balances/${employeeId}/${locationId}`);
        if (!response.ok) {
            throw new common_1.BadGatewayException("HCM realtime balance read failed.");
        }
        return (await response.json());
    }
    async safeFetch(url, init) {
        const timeoutMs = Number(this.configService.get("HCM_TIMEOUT_MS") || "3000");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...init, signal: controller.signal });
        }
        catch {
            throw new common_1.ServiceUnavailableException("HCM is temporarily unavailable.");
        }
        finally {
            clearTimeout(timeout);
        }
    }
};
exports.HcmClient = HcmClient;
exports.HcmClient = HcmClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], HcmClient);
