import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles-decorator";

@Injectable()
export class RoleBasedGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}
    
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const roles = this.reflector.getAllAndOverride(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!roles) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        const hasRole = roles.some(role => user.role?.includes(role));

        if (!hasRole) {
            throw new ForbiddenException('You are not authorized to access this resource');
        }

        return true;
    }
}