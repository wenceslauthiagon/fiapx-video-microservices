import * as dotenv from 'dotenv';
import * as packageJson from '../../package.json';
import { APP_DEFAULTS } from '../shared/app.constants';

const envFile =
  process.env.NODE_ENV === 'development' ? '.env.development' : '.env';

dotenv.config({ path: envFile });
if (envFile !== '.env') {
  dotenv.config({ path: '.env', override: false });
}

const CONFIG: Record<string, any> = {};

function readBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
}

// Geral
CONFIG.APP_CLOUD_ROLENAME =
  process.env.APP_CLOUD_ROLENAME || APP_DEFAULTS.appCloudRoleName;
CONFIG.version = (packageJson as any).version;
CONFIG.port = process.env.APP_DEFAULT_PORT || String(APP_DEFAULTS.apiPort);

// Datadog
CONFIG.DD_ENV = process.env.DD_ENV || APP_DEFAULTS.datadogEnv;
CONFIG.DD_LOGS_INJECTION = readBooleanEnv(process.env.DD_LOGS_INJECTION, true);
CONFIG.DD_AGENT_HOST =
  process.env.DD_AGENT_HOST || APP_DEFAULTS.datadogAgentHost;
CONFIG.DD_TRACE_AGENT_PORT =
  process.env.DD_TRACE_AGENT_PORT || APP_DEFAULTS.datadogTraceAgentPort;
CONFIG.DD_TRACE_DEBUG = readBooleanEnv(process.env.DD_TRACE_DEBUG, false);
CONFIG.DD_SERVICE = process.env.DD_SERVICE || APP_DEFAULTS.datadogService;

// Variaveis adicionais Datadog
CONFIG.DD_VERSION = process.env.DD_VERSION || CONFIG.version;
CONFIG.DD_PROFILING_ENABLED = readBooleanEnv(
  process.env.DD_PROFILING_ENABLED,
  false,
);
CONFIG.DD_RUNTIME_METRICS_ENABLED = readBooleanEnv(
  process.env.DD_RUNTIME_METRICS_ENABLED,
  false,
);
CONFIG.DD_TAGS = process.env.DD_TAGS || '';

// Logs
CONFIG.DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL = readBooleanEnv(
  process.env.DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL,
  true,
);
CONFIG.DD_LOGS_CONFIG_AUTO_MULTI_LINE_DETECTION = readBooleanEnv(
  process.env.DD_LOGS_CONFIG_AUTO_MULTI_LINE_DETECTION,
  true,
);
CONFIG.DD_LOGS_STDOUT = readBooleanEnv(process.env.DD_LOGS_STDOUT, true);
CONFIG.LOG_LEVEL = process.env.LOG_LEVEL || APP_DEFAULTS.logLevel;

// APIs
CONFIG.BASE_URL_API_SALA = process.env.BASE_URL_API_SALA;
CONFIG.BASE_URL_API_LOGIN = process.env.BASE_URL_API_LOGIN;
CONFIG.BASE_URL_API_SOU_IONICA = process.env.BASE_URL_API_SOU_IONICA;
CONFIG.BASE_URL_MS_SIGNALR = process.env.BASE_URL_MS_SIGNALR;
CONFIG.OCP_APIM_SUBSCRIPTION_KEY = process.env.OCP_APIM_SUBSCRIPTION_KEY;

// Redis
CONFIG.REDIS_PREFIX = process.env.REDIS_PREFIX;
CONFIG.REDIS_HOST = process.env.REDIS_HOST;
CONFIG.REDIS_PORT = process.env.REDIS_PORT;

export default CONFIG;
