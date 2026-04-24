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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeOffRequestsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = __importDefault(require("node:crypto"));
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const time_off_balance_entity_1 = require("../balances/time-off-balance.entity");
const hcm_client_1 = require("../hcm/hcm.client");
const time_off_request_entity_1 = require("./time-off-request.entity");
let TimeOffRequestsService = class TimeOffRequestsService {
    requestRepository;
    balanceRepository;
    dataSource;
    hcmClient;
    constructor(requestRepository, balanceRepository, dataSource, hcmClient) {
        this.requestRepository = requestRepository;
        this.balanceRepository = balanceRepository;
        this.dataSource = dataSource;
        this.hcmClient = hcmClient;
    }
    async getById(id) {
        const request = await this.requestRepository.findOne({ where: { id } });
        if (!request) {
            throw new common_1.NotFoundException("Time off request not found.");
        }
        return request;
    }
    async create(dto) {
        if (!dto.employeeId.trim() || !dto.locationId.trim()) {
            throw new common_1.UnprocessableEntityException("employeeId and locationId are required.");
        }
        if (dto.requestedDays <= 0) {
            throw new common_1.UnprocessableEntityException("requestedDays must be greater than 0.");
        }
        if (new Date(dto.endDate) < new Date(dto.startDate)) {
            throw new common_1.UnprocessableEntityException("endDate must be >= startDate.");
        }
        if (dto.idempotencyKey) {
            const existing = await this.requestRepository.findOne({
                where: { idempotencyKey: dto.idempotencyKey }
            });
            if (existing) {
                if (existing.employeeId !== dto.employeeId ||
                    existing.locationId !== dto.locationId ||
                    existing.requestedDays !== dto.requestedDays) {
                    throw new common_1.ConflictException("Idempotency key reused with different payload.");
                }
                return existing;
            }
        }
        const localBalance = await this.balanceRepository.findOne({
            where: { employeeId: dto.employeeId, locationId: dto.locationId }
        });
        if (!localBalance || localBalance.availableDays < dto.requestedDays) {
            throw new common_1.ConflictException("Insufficient local balance.");
        }
        const stagedRequest = this.requestRepository.create({
            employeeId: dto.employeeId,
            locationId: dto.locationId,
            requestedDays: dto.requestedDays,
            startDate: dto.startDate,
            endDate: dto.endDate,
            idempotencyKey: dto.idempotencyKey || null,
            status: time_off_request_entity_1.TimeOffRequestStatus.REQUESTED
        });
        const hcmResult = await this.hcmClient.validateAndDeduct({
            employeeId: dto.employeeId,
            locationId: dto.locationId,
            days: dto.requestedDays,
            requestId: node_crypto_1.default.randomUUID()
        });
        try {
            return await this.dataSource.transaction(async (manager) => {
                const currentBalance = await manager.findOne(time_off_balance_entity_1.TimeOffBalance, {
                    where: { employeeId: dto.employeeId, locationId: dto.locationId }
                });
                if (!currentBalance || currentBalance.availableDays < dto.requestedDays) {
                    throw new common_1.ConflictException("Balance changed during request creation.");
                }
                currentBalance.availableDays -= dto.requestedDays;
                await manager.save(currentBalance);
                stagedRequest.hcmReference = hcmResult.referenceId;
                return manager.save(stagedRequest);
            });
        }
        catch (error) {
            await this.hcmClient.release(dto.employeeId, dto.locationId, dto.requestedDays, stagedRequest.id);
            throw error;
        }
    }
    async approve(id) {
        const request = await this.getById(id);
        if (request.status !== time_off_request_entity_1.TimeOffRequestStatus.REQUESTED) {
            throw new common_1.ConflictException("Only REQUESTED requests can be approved.");
        }
        request.status = time_off_request_entity_1.TimeOffRequestStatus.APPROVED;
        return this.requestRepository.save(request);
    }
    async reject(id) {
        const request = await this.getById(id);
        if (request.status !== time_off_request_entity_1.TimeOffRequestStatus.REQUESTED) {
            throw new common_1.ConflictException("Only REQUESTED requests can be rejected.");
        }
        await this.hcmClient.release(request.employeeId, request.locationId, request.requestedDays, request.id);
        return this.dataSource.transaction(async (manager) => {
            const balance = await manager.findOne(time_off_balance_entity_1.TimeOffBalance, {
                where: { employeeId: request.employeeId, locationId: request.locationId }
            });
            if (!balance) {
                throw new common_1.NotFoundException("Balance missing during rejection.");
            }
            balance.availableDays += request.requestedDays;
            request.status = time_off_request_entity_1.TimeOffRequestStatus.REJECTED;
            await manager.save(balance);
            return manager.save(request);
        });
    }
    async cancel(id) {
        const request = await this.getById(id);
        if (request.status !== time_off_request_entity_1.TimeOffRequestStatus.APPROVED) {
            throw new common_1.ConflictException("Only APPROVED requests can be canceled.");
        }
        await this.hcmClient.release(request.employeeId, request.locationId, request.requestedDays, request.id);
        return this.dataSource.transaction(async (manager) => {
            const balance = await manager.findOne(time_off_balance_entity_1.TimeOffBalance, {
                where: { employeeId: request.employeeId, locationId: request.locationId }
            });
            if (!balance) {
                throw new common_1.NotFoundException("Balance missing during cancellation.");
            }
            balance.availableDays += request.requestedDays;
            request.status = time_off_request_entity_1.TimeOffRequestStatus.CANCELED;
            await manager.save(balance);
            return manager.save(request);
        });
    }
};
exports.TimeOffRequestsService = TimeOffRequestsService;
exports.TimeOffRequestsService = TimeOffRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(time_off_request_entity_1.TimeOffRequest)),
    __param(1, (0, typeorm_1.InjectRepository)(time_off_balance_entity_1.TimeOffBalance)),
    __param(2, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        hcm_client_1.HcmClient])
], TimeOffRequestsService);
