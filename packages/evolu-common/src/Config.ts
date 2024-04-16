import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as LogLevel from "effect/LogLevel";
import * as Logger from "effect/Logger";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Match from "effect/Match";

export interface Config {
  /**
   * URL to reload browser tabs after {@link Owner} reset or restore.
   *
   * The default value is `/`.
   */
  reloadUrl: string;

  /**
   * URL for Evolu sync and backup server
   *
   * The default value is `https://evolu.world`.
   */
  syncUrl: string;

  /**
   * Evolu application name. For now, this is only useful for localhost
   * development, where we want each application to have its own database.
   *
   * The default value is: `Evolu`.
   */
  name: string;

  /**
   * Maximum physical clock drift allowed in ms.
   *
   * The default value is 5 * 60 * 1000 (5 minutes).
   */
  maxDrift: number;

  /**
   * Setting the minimum log level. The default value is `none`.
   *
   * For development, use `trace` to log all events and `debug` to log only
   * events with values. For production, use `warning`.
   */
  minimumLogLevel: "none" | "trace" | "debug" | "warning";
}

export const Config = Context.GenericTag<Config>("Config");

export const defaultConfig: Config = {
  reloadUrl: "/",
  syncUrl: "https://evolu.world",
  name: "Evolu",
  maxDrift: 5 * 60 * 1000,
  minimumLogLevel: "none",
};

/** https://effect.website/docs/guides/runtime */
export const createEvoluRuntime = (
  partialConfig?: Partial<Config>,
): ManagedRuntime.ManagedRuntime<Config, never> => {
  const config = { ...defaultConfig, ...partialConfig };
  const ConfigLive = Layer.succeed(Config, config);

  const minimumLogLevel = Match.value(config.minimumLogLevel).pipe(
    Match.when("debug", () => LogLevel.Debug),
    Match.when("none", () => LogLevel.None),
    Match.when("trace", () => LogLevel.Trace),
    Match.when("warning", () => LogLevel.Warning),
    Match.exhaustive,
  );

  const evoluLayer =
    config.minimumLogLevel === "none"
      ? ConfigLive
      : Layer.mergeAll(
          ConfigLive,
          Logger.minimumLogLevel(minimumLogLevel),
          Logger.replace(Logger.defaultLogger, makeEvoluLogger(config.name)),
        );

  return ManagedRuntime.make(evoluLayer);
};

// TODO: Spans and variadic when supported.
const makeEvoluLogger = (name: string) =>
  Logger.make(({ logLevel, message }) => {
    const fn =
      logLevel._tag === "Warning"
        ? "warn"
        : logLevel._tag === "Error"
          ? "error"
          : "log";
    // This is temp workaround. Next Effect minor will solve it.
    const messages: unknown[] = Array.isArray(message) ? message : [message];
    globalThis.console[fn](`[${name}]`, ...messages);
  });
