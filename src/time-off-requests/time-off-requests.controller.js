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
exports.TimeOffRequestsController = void 0;
const common_1 = require("@nestjs/common");
const create_time_off_request_dto_1 = require("./dto/create-time-off-request.dto");
const time_off_requests_service_1 = require("./time-off-requests.service");
const roles_decorator_1 = require("../security/roles.decorator");
let TimeOffRequestsController = class TimeOffRequestsController {
    requestsService;
    constructor(requestsService) {
        this.requestsService = requestsService;
    }
    getOne(id) {
        return this.requestsService.getById(id);
    }
    create(dto) {
        return this.requestsService.create(dto);
    }
    approve(id) {
        return this.requestsService.approve(id);
    }
    reject(id) {
        return this.requestsService.reject(id);
    }
    cancel(id) {
        return this.requestsService.cancel(id);
    }
};
exports.TimeOffRequestsController = TimeOffRequestsController;
__decorate([
    (0, roles_decorator_1.Roles)(roles_decorator_1.Role.EMPLOYEE, roles_decorator_1.Role.MANAGER, roles_decorator_1.Role.SYSTEM),
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimeOffRequestsController.prototype, "getOne", null);
__decorate([
    (0, roles_decorator_1.Roles)(roles_decorator_1.Role.EMPLOYEE, roles_decorator_1.Role.MANAGER),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_time_off_request_dto_1.CreateTimeOffRequestDto]),
    __metadata("design:returntype", void 0)
], TimeOffRequestsController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)(roles_decorator_1.Role.MANAGER),
    (0, common_1.Patch)(":id/approve"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimeOffRequestsController.prototype, "approve", null);
__decorate([
    (0, roles_decorator_1.Roles)(roles_decorator_1.Role.MANAGER),
    (0, common_1.Patch)(":id/reject"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimeOffRequestsController.prototype, "reject", null);
__decorate([
    (0, roles_decorator_1.Roles)(roles_decorator_1.Role.MANAGER),
    (0, common_1.Patch)(":id/cancel"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimeOffRequestsController.prototype, "cancel", null);
exports.TimeOffRequestsController = TimeOffRequestsController = __decorate([
    (0, common_1.Controller)("time-off-requests"),
    __metadata("design:paramtypes", [time_off_requests_service_1.TimeOffRequestsService])
], TimeOffRequestsController);
