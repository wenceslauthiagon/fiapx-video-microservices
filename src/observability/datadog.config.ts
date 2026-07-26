import tracer from 'dd-trace';

export class DatadogConfig {
  private static initialized = false;

  static initialize(): void {
    if (DatadogConfig.initialized) {
      return;
    }

    const nodeOptions = process.env.NODE_OPTIONS || '';
    const preloadedByNodeOptions = nodeOptions.includes('dd-trace-init.js');

    if (preloadedByNodeOptions) {
      DatadogConfig.initialized = true;
      console.log('Datadog APM ja inicializado via NODE_OPTIONS');
      return;
    }

    const enableDatadog =
      process.env.ENABLE_DATADOG === 'true' ||
      process.env.NODE_ENV === 'production';

    if (enableDatadog) {
      tracer.init({
        service: process.env.DD_SERVICE || 'api-fiapx-hackathon-dev',
        env:
          process.env.DD_ENV ||
          process.env.NODE_ENV ||
          'fiapx-hackathon-dev-v1',
        version:
          process.env.DD_VERSION || process.env.BUILD_BUILDNUMBER || '0.0.1',
        logInjection: true,
        runtimeMetrics: true,
        profiling: true,
        tags: {
          team: 'api-fiapx-hackathon-dev',
          project: 'fiapx-hackathon-dev-v1',
          component: 'backend',
        },
        plugins: true,
      });

      DatadogConfig.initialized = true;
      console.log('Datadog APM inicializado com sucesso');
    } else {
      DatadogConfig.initialized = true;
      console.log('Datadog APM desabilitado (ambiente de desenvolvimento)');
    }
  }

  static createCustomSpan(
    operationName: string,
    tags: Record<string, any> = {},
  ) {
    const span = tracer.startSpan(operationName, {
      tags: {
        ...tags,
        service: 'api-fiapx-hackathon-dev',
      },
    });
    return span;
  }

  static addCustomTags(tags: Record<string, any>) {
    const activeSpan = tracer.scope().active();
    if (activeSpan) {
      Object.entries(tags).forEach(([key, value]) => {
        activeSpan.setTag(key, value);
      });
    }
  }
}
