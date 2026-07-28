import path from "node:path"
import winston from "winston"
import { ENV } from "./env.js"

const { combine, timestamp, printf, colorize, errors, splat } = winston.format

const consoleFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} [${level}] ${stack || message}`
})

const fileFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""
  return `${ts} [${level.toUpperCase()}] ${stack || message}${rest}`
})

/**
 * Single shared logger used across configs, hooks, page objects, and utils.
 *
 * Levels — winston: error < warn < info < http < verbose < debug < silly.
 * We map WDIO `silent` → winston `error` (effectively quiet).
 */
const winstonLevel = ENV.logLevel === "silent" ? "error" : ENV.logLevel
const LOG_DIR = path.resolve(process.cwd(), "logs")

export const logger = winston.createLogger({
  level: winstonLevel,
  format: combine(errors({ stack: true }), splat(), timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" })),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), consoleFormat)
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, "test-run.log"),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, "errors.log"),
      level: "error",
      format: fileFormat
    })
  ]
})

/**
 * Scoped child logger — useful for tagging output with the page/feature name.
 *
 *   const log = childLogger("LoginPage")
 *   log.info("waiting for element")  →  "... [info] [LoginPage] waiting for element"
 */
export const childLogger = (scope: string): winston.Logger => logger.child({ scope })

export default logger
