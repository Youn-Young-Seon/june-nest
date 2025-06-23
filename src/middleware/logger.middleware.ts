import { Injectable, NestMiddleware, UnauthorizedException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NextFunction } from "express";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {

    private readonly logger = new Logger(LoggerMiddleware.name);

    constructor(
        private jwtService: JwtService,
    ) {}

    use(req: Request, res: Response, next: NextFunction) {
        const token = req.headers['authorization']?.replace('Bearer ', '');

        if (token) {
            try {
                const decoded = this.jwtService.verify(token);
                this.logger.log("middleware decoded", decoded);
                req['user'] = decoded;
            } catch (error) {
                throw new UnauthorizedException('Invalid token');
            }
        }

        next();
    }
}