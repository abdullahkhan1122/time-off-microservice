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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const node_crypto_1 = __importDefault(require("node:crypto"));
const roles_decorator_1 = require("./roles.decorator");
let SecurityGuard = class SecurityGuard {
    reflector;
    configService;
    constructor(reflector, configService) {
        this.reflector = reflector;
        this.configService = configService;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        this.assertValidApiKey(request);
        const allowedRoles = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [
            context.getHandler(),
            context.getClass()
        ]) || [];
        if (allowedRoles.length === 0) {
            return true;
        }
        const role = this.readHeader(request, "x-user-role");
        if (!role || !allowedRoles.includes(role)) {
            throw new common_1.ForbiddenException("Insufficient role for this operation.");
        }
        return true;
    }
    assertValidApiKey(request) {
        const expectedApiKey = this.configService.get("API_KEY");
        if (!expectedApiKey) {
            throw new common_1.UnauthorizedException("API key is not configured.");
        }
        const providedApiKey = this.readHeader(request, "x-api-key");
        if (!providedApiKey || !this.constantTimeEqual(providedApiKey, expectedApiKey)) {
            throw new common_1.UnauthorizedException("Invalid API key.");
        }
    }
    readHeader(request, name) {
        const value = request.headers[name];
        if (Array.isArray(value)) {
            return value[0];
        }
        return value;
    }
    constantTimeEqual(a, b) {
        const left = Buffer.from(a);
        const right = Buffer.from(b);
        return left.length === right.length && node_crypto_1.default.timingSafeEqual(left, right);
    }
};
exports.SecurityGuard = SecurityGuard;
exports.SecurityGuard = SecurityGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        config_1.ConfigService])
], SecurityGuard);
