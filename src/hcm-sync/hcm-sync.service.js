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
exports.HcmSyncService = void 0;
const common_1 = require("@nestjs/common");
const balances_service_1 = require("../balances/balances.service");
const hcm_client_1 = require("../hcm/hcm.client");
let HcmSyncService = class HcmSyncService {
    balancesService;
    hcmClient;
    constructor(balancesService, hcmClient) {
        this.balancesService = balancesService;
        this.hcmClient = hcmClient;
    }
    async realtimeReconcile(employeeId, locationId) {
        const hcmBalance = await this.hcmClient.getBalance(employeeId, locationId);
        return this.balancesService.upsertOne({
            employeeId: hcmBalance.employeeId,
            locationId: hcmBalance.locationId,
            availableDays: hcmBalance.availableDays
        });
    }
    async batchReconcile(items) {
        return this.balancesService.upsertMany(items);
    }
};
exports.HcmSyncService = HcmSyncService;
exports.HcmSyncService = HcmSyncService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [balances_service_1.BalancesService,
        hcm_client_1.HcmClient])
], HcmSyncService);
