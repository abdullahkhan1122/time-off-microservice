"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const balances_module_1 = require("./balances/balances.module");
const time_off_requests_module_1 = require("./time-off-requests/time-off-requests.module");
const hcm_sync_module_1 = require("./hcm-sync/hcm-sync.module");
const time_off_balance_entity_1 = require("./balances/time-off-balance.entity");
const time_off_request_entity_1 = require("./time-off-requests/time-off-request.entity");
const hcm_module_1 = require("./hcm/hcm.module");
const security_module_1 = require("./security/security.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRoot({
                type: "sqlite",
                database: process.env.DB_PATH || "timeoff.sqlite",
                entities: [time_off_balance_entity_1.TimeOffBalance, time_off_request_entity_1.TimeOffRequest],
                synchronize: process.env.NODE_ENV !== "production"
            }),
            security_module_1.SecurityModule,
            balances_module_1.BalancesModule,
            time_off_requests_module_1.TimeOffRequestsModule,
            hcm_sync_module_1.HcmSyncModule,
            hcm_module_1.HcmModule
        ]
    })
], AppModule);
