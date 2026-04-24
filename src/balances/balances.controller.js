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
exports.BalancesController = void 0;
const common_1 = require("@nestjs/common");
const balances_service_1 = require("./balances.service");
const upsert_balance_dto_1 = require("./dto/upsert-balance.dto");
const roles_decorator_1 = require("../security/roles.decorator");
let BalancesController = class BalancesController {
    balancesService;
    constructor(balancesService) {
        this.balancesService = balancesService;
    }
    getOne(employeeId, locationId) {
        return this.balancesService.findOne(employeeId, locationId);
    }
    upsertOne(dto) {
        return this.balancesService.upsertOne(dto);
    }
};
exports.BalancesController = BalancesController;
__decorate([
    (0, roles_decorator_1.Roles)(roles_decorator_1.Role.EMPLOYEE, roles_decorator_1.Role.MANAGER, roles_decorator_1.Role.SYSTEM),
    (0, common_1.Get)(":employeeId/:locationId"),
    __param(0, (0, common_1.Param)("employeeId")),
    __param(1, (0, common_1.Param)("locationId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BalancesController.prototype, "getOne", null);
__decorate([
    (0, roles_decorator_1.Roles)(roles_decorator_1.Role.SYSTEM),
    (0, common_1.Post)("bootstrap"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [upsert_balance_dto_1.UpsertBalanceDto]),
    __metadata("design:returntype", void 0)
], BalancesController.prototype, "upsertOne", null);
exports.BalancesController = BalancesController = __decorate([
    (0, common_1.Controller)("balances"),
    __metadata("design:paramtypes", [balances_service_1.BalancesService])
], BalancesController);
