"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const security_guard_1 = require("../src/security/security.guard");
const roles_decorator_1 = require("../src/security/roles.decorator");
describe("SecurityGuard", () => {
    const createContext = (headers) => ({
        switchToHttp: () => ({
            getRequest: () => ({ headers })
        }),
        getHandler: () => "handler",
        getClass: () => "class"
    });
    const createGuard = (roles, apiKey = "secret") => {
        const reflector = {
            getAllAndOverride: jest.fn().mockReturnValue(roles)
        };
        const configService = {
            get: jest.fn().mockReturnValue(apiKey)
        };
        return new security_guard_1.SecurityGuard(reflector, configService);
    };
    it("allows request with valid api key and role", () => {
        const guard = createGuard([roles_decorator_1.Role.MANAGER]);
        const context = createContext({
            "x-api-key": "secret",
            "x-user-role": roles_decorator_1.Role.MANAGER
        });
        expect(guard.canActivate(context)).toBe(true);
    });
    it("rejects missing api key", () => {
        const guard = createGuard([roles_decorator_1.Role.EMPLOYEE]);
        const context = createContext({ "x-user-role": roles_decorator_1.Role.EMPLOYEE });
        expect(() => guard.canActivate(context)).toThrow(common_1.UnauthorizedException);
    });
    it("rejects invalid api key", () => {
        const guard = createGuard([roles_decorator_1.Role.EMPLOYEE]);
        const context = createContext({
            "x-api-key": "wrong",
            "x-user-role": roles_decorator_1.Role.EMPLOYEE
        });
        expect(() => guard.canActivate(context)).toThrow(common_1.UnauthorizedException);
    });
    it("rejects valid api key with insufficient role", () => {
        const guard = createGuard([roles_decorator_1.Role.MANAGER]);
        const context = createContext({
            "x-api-key": "secret",
            "x-user-role": roles_decorator_1.Role.EMPLOYEE
        });
        expect(() => guard.canActivate(context)).toThrow(common_1.ForbiddenException);
    });
    it("allows valid api key when route has no role metadata", () => {
        const guard = createGuard([]);
        const context = createContext({ "x-api-key": "secret" });
        expect(guard.canActivate(context)).toBe(true);
    });
});
