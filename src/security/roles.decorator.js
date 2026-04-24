"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Roles = exports.ROLES_KEY = exports.Role = void 0;
const common_1 = require("@nestjs/common");
var Role;
(function (Role) {
    Role["EMPLOYEE"] = "EMPLOYEE";
    Role["MANAGER"] = "MANAGER";
    Role["SYSTEM"] = "SYSTEM";
})(Role || (exports.Role = Role = {}));
exports.ROLES_KEY = "roles";
const Roles = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.Roles = Roles;
