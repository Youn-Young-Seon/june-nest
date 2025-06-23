import { WinstonModule } from "nest-winston";
import { format, transports } from "winston";

const { combine, timestamp, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp}) => {
    return `${timestamp} ${level}: ${message}`;
});

const getTransports = () => {
    const isProduction = process.env.NODE_ENV === 'prod';
  
    const consoleTransport = new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
    });
  
    const fileTransport = new transports.File({
      filename: 'logs/combined.log',
      level: 'info',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
    });
  
    const errorFileTransport = new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
    });
  
    // 프로덕션 환경에서는 파일 로그만, 개발 환경에서는 콘솔 로그만 사용
    return isProduction ? [fileTransport, errorFileTransport] : [consoleTransport];
};

export const winstonLogger = WinstonModule.createLogger({
    transports: getTransports(),
});