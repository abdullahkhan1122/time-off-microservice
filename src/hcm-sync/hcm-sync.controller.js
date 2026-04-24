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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HcmSyncController = void 0;
const common_1 = require("@nestjs/common");
const batch_sync_dto_1 = require("./dto/batch-sync.dto");
const reconcile_balance_dto_1 = require("./dto/reconcile-balance.dto");
const hcm_sync_service_1 = require("./hcm-sync.service");
const roles_decorator_1 = require("../security/roles.decorator");
let HcmSyncController = class HcmSyncController {
    hcmSyncService;
    constructor(hcmSyncService) {
        this.hcmSyncService = hcmSyncService;
    }
    batch(dto) {
        return this.hcmSyncService.batchReconcile(dto.items);
    }
    realtime(dto) {
        return this.hcmSyncService.realtimeReconcile(dto.employeeId, dto.locationId);
    }
};
exports.HcmSyncController = HcmSyncController;
__decorate([
    (0, roles_decorator_1.Roles)(roles_decorator_1.Role.SYSTEM),
    (0, common_1.Post)("batch"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [batch_sync_dto_1.BatchSyncDto]),
    __metadata("design:returntype", void 0)
], HcmSyncController.prototype, "batch", null);
__decorate([
    (0, roles_decorator_1.Roles)(roles_decorator_1.Role.SYSTEM),
    (0, common_1.Post)("realtime"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reconcile_balance_dto_1.ReconcileBalanceDto]),
    __metadata("design:returntype", void 0)
], HcmSyncController.prototype, "realtime", null);
exports.HcmSyncController = HcmSyncController = __decorate([
    (0, common_1.Controller)("hcm-sync"),
    __metadata("design:paramtypes", [hcm_sync_service_1.HcmSyncService])
], HcmSyncController);
