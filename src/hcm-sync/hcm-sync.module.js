"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HcmSyncModule = void 0;
const common_1 = require("@nestjs/common");
const hcm_sync_service_1 = require("./hcm-sync.service");
const hcm_sync_controller_1 = require("./hcm-sync.controller");
const balances_module_1 = require("../balances/balances.module");
const hcm_module_1 = require("../hcm/hcm.module");
let HcmSyncModule = class HcmSyncModule {
};
exports.HcmSyncModule = HcmSyncModule;
exports.HcmSyncModule = HcmSyncModule = __decorate([
    (0, common_1.Module)({
        imports: [balances_module_1.BalancesModule, hcm_module_1.HcmModule],
        providers: [hcm_sync_service_1.HcmSyncService],
        controllers: [hcm_sync_controller_1.HcmSyncController]
    })
], HcmSyncModule);
