import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NextFunction } from "express";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    constructor(
        private jwtService: JwtService,
    ) {}

    use(req: Request, res: Response, next: NextFunction) {
        console.log(`[${req.method}] [${req.url}]`);

        const token = req.headers['authorization']?.replace('Bearer ', '');

        if (token) {
            try {
                const decoded = this.jwtService.verify(token);
                console.log(decoded);
                req['user'] = decoded;
            } catch (error) {
                throw new UnauthorizedException('Invalid token');
            }
        }

        next();
    }
}